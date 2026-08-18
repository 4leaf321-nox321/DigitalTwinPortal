# 오프라인 환경 설정 가이드

Knowledge Graph Project를 인터넷이 안 되는 오프라인 환경에서 설치하고 실행하는 방법입니다.

---

## 📋 목차

1. [준비물 체크리스트](#준비물-체크리스트)
2. [현재 환경에서 준비하기](#현재-환경에서-준비하기)
3. [오프라인 환경에서 설치하기](#오프라인-환경에서-설치하기)
4. [문제 해결](#문제-해결)

---

## 준비물 체크리스트

### 현재 환경에서 준비할 것들

- [ ] PostgreSQL 설치 파일 (`.exe` 또는 portable 버전)
- [ ] Python 설치 파일 (3.9 이상)
- [ ] Node.js 설치 파일 (18.x 이상)
- [ ] 전체 프로젝트 폴더
- [ ] 데이터베이스 덤프 파일
- [ ] Python 패키지들 (backend/packages 폴더)
- [ ] Python 패키지들 — MCP 서버 (mcp_server/packages 폴더) ※ AI 연동을 쓸 때만
- [ ] Node.js 패키지들 (frontend/node_modules 폴더)

---

## 현재 환경에서 준비하기

### 1. PostgreSQL 설치 파일 다운로드

공식 사이트에서 다운로드:
- https://www.postgresql.org/download/windows/
- **권장 버전**: PostgreSQL 16.x

또는 Portable 버전:
- https://sourceforge.net/projects/postgresqlportable/

### 2. Python 설치 파일 다운로드

공식 사이트에서 다운로드:
- https://www.python.org/downloads/
- **권장 버전**: Python 3.11 이상

### 3. Node.js 설치 파일 다운로드

공식 사이트에서 다운로드:
- https://nodejs.org/
- **권장 버전**: Node.js 18.x LTS 이상

### 4. 데이터베이스 덤프 생성

```bash
cd backend
python export_database.py
```

생성되는 파일들:
- `database_dump_YYYYMMDD_HHMMSS.sql` - 데이터베이스 백업 파일
- `database_dump_YYYYMMDD_HHMMSS_info.txt` - 덤프 정보

### 5. Python 패키지 확인

```bash
cd backend
dir packages
```

패키지들이 이미 `backend/packages` 폴더에 준비되어 있어야 합니다.

### 6. Frontend 패키지 확인

Frontend는 `node_modules` 폴더를 통째로 복사하거나, 오프라인 환경에서 직접 설치할 수 있습니다.

**옵션 1: node_modules 복사** (권장)
```bash
cd frontend
# node_modules 폴더가 있는지 확인
dir node_modules
```

**옵션 2: npm 패키지 캐시 다운로드**
```bash
cd frontend
npm install
# %APPDATA%\npm-cache 폴더 백업
```

### 7. 파일 정리

오프라인 환경으로 가져갈 폴더/파일:

```
52_KnowledgeGraphProject/
├── frontend/              # 전체 복사
│   ├── node_modules/      # (옵션 1인 경우)
│   └── ...
├── backend/               # 전체 복사
│   ├── packages/          # Python 패키지들
│   ├── export_database.py
│   ├── import_database.py
│   ├── setup_database.py
│   ├── database_dump_*.sql  # 덤프 파일
│   └── ...
├── mcp_server/            # 전체 복사 (AI 연동을 쓸 때)
│   ├── packages/          # Python 패키지들 (wheel 31개)
│   ├── skill/             # AI 사용 안내 — 화면이 이 파일을 내려준다. 빠지면 404
│   ├── setup_venv.bat
│   └── ...
├── OFFLINE_SETUP.md       # 이 파일
└── README.md

추가로 준비:
- PostgreSQL_installer.exe
- python-installer.exe
- node-installer.msi
```

---

## 오프라인 환경에서 설치하기

### Step 1: 기본 소프트웨어 설치

#### 1.1 PostgreSQL 설치

1. `PostgreSQL_installer.exe` 실행
2. 설치 옵션:
   - Port: `5432` (기본값)
   - Password: 기억하기 쉬운 비밀번호 설정 (예: `postgres`)
   - Locale: `Korean, Korea` 또는 `Default locale`

3. 설치 완료 후 확인:
   ```cmd
   psql --version
   ```

4. PATH 설정 확인 (안 되어 있으면 수동 추가):
   ```
   C:\Program Files\PostgreSQL\16\bin
   ```

#### 1.2 Python 설치

1. `python-installer.exe` 실행
2. **중요**: "Add Python to PATH" 체크
3. 설치 완료 후 확인:
   ```cmd
   python --version
   pip --version
   ```

#### 1.3 Node.js 설치

1. `node-installer.msi` 실행
2. 기본 설정으로 설치
3. 설치 완료 후 확인:
   ```cmd
   node --version
   npm --version
   ```

---

### Step 2: Backend 설정

#### 2.1 가상환경 생성

```cmd
cd backend
python -m venv venv
```

이렇게 하면 `backend/venv` 폴더가 생성됩니다.

#### 2.2 가상환경 활성화

**CMD (명령 프롬프트):**
```cmd
venv\Scripts\activate
```

**PowerShell:**
```powershell
venv\Scripts\Activate.ps1
```

PowerShell에서 오류가 나면:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
venv\Scripts\Activate.ps1
```

활성화되면 프롬프트 앞에 `(venv)`가 표시됩니다:
```
(venv) C:\...\backend>
```

#### 2.3 Python 패키지 설치

**가상환경 활성화 상태에서:**
```cmd
pip install --no-index --find-links=packages -r requirements.txt
```

설명:
- `--no-index`: 인터넷 사용 안 함
- `--find-links=packages`: packages 폴더에서 패키지 찾기

#### 2.4 환경 변수 설정 (.env 파일)

1. `.env.example` 파일을 `.env`로 복사:
   ```cmd
   copy .env.example .env
   ```

2. `.env` 파일 수정 (메모장으로 열기):
   ```env
   # Flask Configuration
   FLASK_ENV=production
   FLASK_HOST=0.0.0.0
   FLASK_PORT=5000
   SECRET_KEY=your-secret-key-change-this-randomly

   # JWT Configuration
   JWT_SECRET_KEY=your-jwt-secret-key-change-this-randomly

   # CORS Configuration (쉼표로 구분, 공백 없이)
   # 실제 접속할 IP 주소로 변경하세요
   CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://192.168.1.100:5174

   # Database Configuration
   DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/dxdigitaltwin

   # Test Database (선택사항)
   TEST_DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/dxdigitaltwin_test
   ```

   **중요한 설정:**
   - `YOUR_PASSWORD`: PostgreSQL 설치 시 설정한 비밀번호로 변경
   - `CORS_ORIGINS`: Frontend 접속 URL을 모두 포함 (예: `http://192.168.1.100:5174`)
   - `postgresql+psycopg://`: psycopg3 드라이버 사용 (필수)

#### 2.5 데이터베이스 복원

**가상환경 활성화 상태에서:**
```cmd
python import_database.py database_dump_YYYYMMDD_HHMMSS.sql
```

진행 과정:
1. 환경 변수 로드
2. PostgreSQL 연결 확인
3. 데이터베이스 재생성
4. 덤프 파일 복원 (시간이 걸릴 수 있음)
5. 복원 검증

#### 2.6 Backend 서버 테스트

**가상환경 활성화 상태에서:**
```cmd
python run.py
```

정상 작동 시 출력:
```
 * Running on http://0.0.0.0:5000
```

브라우저에서 확인: http://localhost:5000

---

### Step 3: Frontend 설정

#### 3.1 Node.js 패키지 설치

**옵션 1: node_modules 폴더가 있는 경우** (권장)
```cmd
cd frontend
# 이미 node_modules가 있으므로 설치 불필요
```

**옵션 2: node_modules가 없는 경우**
```cmd
cd frontend
npm install --offline
# 또는 캐시 사용
npm install --prefer-offline
```

#### 3.2 환경 변수 설정

Frontend의 `.env` 파일 확인/수정:
```env
VITE_API_URL=http://localhost:5000
```

오프라인 환경의 서버 IP가 다르면 수정:
```env
VITE_API_URL=http://192.168.1.100:5000
```

#### 3.3 Frontend 서버 테스트

```cmd
cd frontend
npm run dev
```

정상 작동 시 출력:
```
  VITE ready in XXX ms
  ➜  Local:   http://localhost:5173/
```

브라우저에서 확인: http://localhost:5173

---

### Step 4: MCP 서버 설정 (AI 연동을 쓸 때만)

Claude Code · Gemini CLI 같은 외부 AI 가 과제를 조회·수정하게 하는 서버입니다.
**안 쓰면 건너뛰어도 나머지는 정상 동작합니다.**

#### 4.1 설치

```cmd
cd mcp_server
setup_venv.bat
```

venv 생성 → `packages` 에서 오프라인 설치 → 기동 확인까지 한 번에 합니다.
(PowerShell 은 `.\setup_venv.ps1`)

**Python 3.13 이어야 합니다** — 번들의 wheel 이 `cp313` 용입니다(Backend 와 같은 버전).

#### 4.2 실행

```cmd
set DT_API_BASE=http://localhost:5174
venv\Scripts\python.exe server.py
```

- **Backend 가 떠 있어야 합니다.** 이 서버는 Backend REST API 를 부르는 대리인이라
  혼자서는 아무것도 못 합니다.
- `DT_API_BASE` 는 **Backend 포트**입니다(Frontend 5173 이 아닙니다).
- ⚠️ **콘솔 창을 닫으면 죽습니다.** 상시 기동 방법(서비스 등록)은 아직 정하지 않았습니다.

#### 4.3 사용자 등록

각 사용자가 웹에서 **계정 관리 ▸ MCP 연결** 로 들어가 개인 토큰을 발급받고,
거기 나오는 `claude mcp add …` 명령을 그대로 붙여넣습니다.
같은 자리에서 **AI 사용 안내(SKILL.md)** 도 내려받을 수 있습니다.

> ⚠️ 압축할 때 **`mcp_server` 폴더가 통째로 들어가야** 합니다.
> 빠지면 화면의 SKILL.md 내려받기가 404 가 됩니다.

---

### Step 5: 전체 시스템 테스트

#### 5.1 Backend 실행

터미널 1:
```cmd
cd backend
venv\Scripts\activate
python run.py
```

**중요**: 가상환경을 먼저 활성화한 후 서버를 실행하세요!

#### 5.2 Frontend 실행

터미널 2:
```cmd
cd frontend
npm run dev
```

#### 5.3 로그인 테스트

1. 브라우저에서 http://localhost:5173 접속
2. 관리자 계정으로 로그인
   - 덤프 파일에 포함된 계정 정보 사용
3. 주요 기능 테스트:
   - 대시보드 확인
   - 지식 그래프 조회
   - 데이터 생성/수정

---

## 문제 해결

### PostgreSQL 관련

**문제: psql을 찾을 수 없습니다**
```
해결: PostgreSQL bin 폴더를 PATH에 추가
1. 시스템 환경 변수 편집
2. Path에 추가: C:\Program Files\PostgreSQL\16\bin
3. CMD 재시작
```

**문제: 데이터베이스 연결 실패**
```
해결 1: PostgreSQL 서비스 실행 확인
- services.msc 실행
- postgresql-x64-16 서비스가 실행 중인지 확인

해결 2: .env 파일의 DATABASE_URL 확인
- 비밀번호가 맞는지 확인
- 포트 번호가 맞는지 확인 (기본: 5432)
```

**문제: 덤프 복원 실패**
```
해결: 수동으로 복원
1. pgAdmin 열기
2. 새 데이터베이스 생성 (이름: dxdigitaltwin)
3. Restore 메뉴에서 덤프 파일 선택
```

---

### Python 관련

**문제: pip install 실패**
```
해결 1: Python PATH 확인
python --version
pip --version

해결 2: 패키지 파일 확인
dir backend\packages
.whl 파일들이 있는지 확인

해결 3: 수동 설치
cd backend\packages
pip install *.whl
```

**문제: import 오류 (ModuleNotFoundError)**
```
해결: 패키지 재설치
cd backend
pip install --no-index --find-links=packages --force-reinstall -r requirements.txt
```

---

### Frontend 관련

**문제: npm install 실패 (오프라인)**
```
해결 1: node_modules 폴더를 온라인 환경에서 복사
- 온라인 환경에서 npm install 실행
- node_modules 폴더 전체를 오프라인 환경으로 복사

해결 2: npm 캐시 사용
- %APPDATA%\npm-cache 폴더를 온라인 환경에서 복사
- npm install --prefer-offline
```

**문제: API 연결 실패**
```
해결 1: Backend 서버 실행 확인
http://localhost:5000 접속 테스트

해결 2: .env 파일의 VITE_API_URL 확인
Frontend .env 파일 열기
VITE_API_URL=http://localhost:5000
```

**문제: CORS 에러 (로그인 시)**
```
오류 메시지: "Access to XMLHttpRequest has been blocked by CORS policy"
            "No 'Access-Control-Allow-Origin' header is present"

원인: Backend가 Frontend의 요청을 차단함

해결: Backend .env 파일의 CORS_ORIGINS 수정
1. backend/.env 파일 열기
2. CORS_ORIGINS에 Frontend 접속 URL 추가

예시:
# localhost로 접속하는 경우
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5174

# IP 주소로 접속하는 경우
CORS_ORIGINS=http://192.168.1.100:5174,http://localhost:5174

# 여러 IP 주소를 허용하는 경우
CORS_ORIGINS=http://localhost:5174,http://192.168.1.100:5174,http://192.168.1.101:5174

주의사항:
- 쉼표(,)로 구분, 공백 없이 입력
- http:// 또는 https:// 프로토콜 필수
- 포트 번호 포함 (예: :5174)
- Backend 서버 재시작 필요
```

---

### 데이터베이스 관련

**문제: 테이블이 없습니다**
```
해결 1: 덤프 복원 재시도
python import_database.py database_dump_YYYYMMDD_HHMMSS.sql

해결 2: setup_database.py 사용 (빈 테이블 생성)
python setup_database.py
```

**문제: 데이터가 없습니다**
```
확인: 덤프 파일 크기 확인
dir database_dump_*.sql
파일 크기가 너무 작으면 덤프 재생성 필요

해결: 온라인 환경에서 덤프 재생성
python export_database.py
```

---

## 운영 모드로 실행

개발 모드가 아닌 운영 모드로 실행하려면:

### Backend (Gunicorn 사용)

```cmd
cd backend
venv\Scripts\activate
gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"
```

### Frontend (빌드 후 서빙)

```cmd
cd frontend
npm run build
npm run preview
```

또는 정적 파일 서버 사용:
```cmd
cd frontend
npx serve -s dist -l 5173
```

---

## 체크리스트 (최종 확인)

설치 완료 후 모든 항목을 확인하세요:

- [ ] PostgreSQL이 설치되고 서비스가 실행 중
- [ ] Python 3.13이 설치됨
- [ ] Node.js가 설치됨
- [ ] Backend 가상환경(venv)이 생성됨
- [ ] 가상환경에 패키지가 모두 설치됨
- [ ] Backend .env 파일이 올바르게 설정됨
- [ ] Frontend .env 파일이 올바르게 설정됨
- [ ] 데이터베이스가 복원되고 테이블이 존재함
- [ ] Backend 서버가 정상 실행됨 (http://localhost:5000)
- [ ] Frontend가 정상 실행됨 (http://localhost:5173)
- [ ] 로그인이 정상 작동함
- [ ] 주요 기능이 정상 작동함

---

## 추가 도움말

### 로그 확인

**Backend 로그:**
```cmd
cd backend
python run.py 2>&1 | tee backend.log
```

**Frontend 로그:**
```cmd
cd frontend
npm run dev 2>&1 | tee frontend.log
```

### 관리자 계정 생성 (필요시)

덤프 파일에 관리자 계정이 없는 경우:
```cmd
cd backend
python set_admin.py
```

---

## 문의

문제가 해결되지 않으면:
1. 이 파일의 문제 해결 섹션 확인
2. 로그 파일 확인 (backend.log, frontend.log)
3. database_dump_*_info.txt 파일 확인

---

**최종 업데이트**: 2025-01-25
