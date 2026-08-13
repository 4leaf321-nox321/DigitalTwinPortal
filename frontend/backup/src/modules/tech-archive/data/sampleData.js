export const sampleTechDocs = [
  {
    id: 'react-best-practices',
    title: 'React 개발 베스트 프랙티스',
    category: 'gtr',
    type: 'platform-development',
    tags: ['react', 'javascript', 'best-practices', 'frontend', 'hooks'],
    author: '프론트엔드팀',
    assignees: ['김민수', '이수진', '박준호'],
    createdAt: '2024-01-15',
    updatedAt: '2024-11-20',
    status: 'completed',
    version: '2.1',
    description: 'React 애플리케이션 개발 시 따라야 할 코딩 컨벤션과 베스트 프랙티스 가이드',
    content: `# React 개발 베스트 프랙티스

## 개요
이 문서는 React 애플리케이션 개발 시 따라야 할 코딩 컨벤션과 베스트 프랙티스를 정의합니다.

## 컴포넌트 설계 원칙

### 1. 단일 책임 원칙
- 하나의 컴포넌트는 하나의 책임만 가져야 합니다
- 컴포넌트가 복잡해지면 여러 작은 컴포넌트로 분리하세요

### 2. 함수형 컴포넌트 사용
\`\`\`jsx
// Good
const UserProfile = ({ user }) => {
  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
};

// Avoid (클래스 컴포넌트는 필요한 경우에만)
class UserProfile extends React.Component {
  render() {
    return (
      <div className="user-profile">
        <h2>{this.props.user.name}</h2>
        <p>{this.props.user.email}</p>
      </div>
    );
  }
}
\`\`\`

### 3. PropTypes 또는 TypeScript 사용
\`\`\`jsx
import PropTypes from 'prop-types';

const UserProfile = ({ user, onEdit }) => {
  // 컴포넌트 구현
};

UserProfile.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired
  }).isRequired,
  onEdit: PropTypes.func
};
\`\`\`

## Hooks 사용 가이드

### useState
- 상태가 복잡하다면 useReducer 고려
- 여러 관련된 상태는 객체로 관리

### useEffect
- 의존성 배열을 정확히 명시
- cleanup 함수 활용
- 불필요한 리렌더링 방지

### Custom Hooks
- 로직 재사용을 위한 커스텀 훅 활용
- 네이밍은 'use'로 시작

## 성능 최적화

### React.memo
- 불필요한 리렌더링 방지
- props가 자주 변경되지 않는 컴포넌트에 적용

### useMemo, useCallback
- 복잡한 계산이나 객체 생성 시 사용
- 의존성 배열 정확히 명시

### 코드 분할
- React.lazy와 Suspense 활용
- 라우트 레벨에서 코드 분할

## 폴더 구조
\`\`\`
src/
  components/
    common/
    layout/
    feature/
  hooks/
  utils/
  pages/
  services/
\`\`\`

## 스타일링
- CSS Modules 또는 styled-components 사용
- BEM 방법론 적용 (CSS 사용 시)
- 재사용 가능한 스타일 컴포넌트 생성

## 테스팅
- React Testing Library 사용
- 사용자 행동 중심 테스트 작성
- 단위 테스트와 통합 테스트 균형

이 가이드는 지속적으로 업데이트되며, 팀의 피드백을 반영하여 개선됩니다.`,
    relatedDocs: ['javascript-style-guide', 'component-library'],
    attachments: [],
    readCount: 156,
    likes: 42
  },
  {
    id: 'api-design-principles',
    title: 'REST API 설계 원칙',
    category: 'mx',
    type: 'infrastructure',
    tags: ['api', 'rest', 'backend', 'design', 'http'],
    author: '백엔드팀',
    assignees: ['정민재', '최서연'],
    createdAt: '2024-02-10',
    updatedAt: '2024-11-18',
    status: 'active',
    version: '1.5',
    description: 'RESTful API 설계 시 준수해야 할 원칙과 규칙',
    content: `# REST API 설계 원칙

## 기본 원칙

### 1. 자원(Resource) 기반 URL
- URL은 자원을 나타내야 함
- 동사가 아닌 명사 사용
- 복수형 사용 권장

\`\`\`
Good:
GET /users
GET /users/123
POST /users

Bad:
GET /getUsers
GET /user/123
POST /createUser
\`\`\`

### 2. HTTP 메소드 활용
- GET: 조회
- POST: 생성
- PUT: 전체 수정
- PATCH: 부분 수정
- DELETE: 삭제

### 3. 상태 코드 활용
- 200: 성공
- 201: 생성 성공
- 400: 잘못된 요청
- 401: 인증 실패
- 404: 자원 없음
- 500: 서버 오류

## URL 설계 규칙

### 계층 구조
\`\`\`
/users/{userId}/posts/{postId}/comments
\`\`\`

### 필터링, 정렬, 페이징
\`\`\`
GET /users?status=active&sort=name&page=1&limit=20
\`\`\`

### 버전 관리
\`\`\`
/api/v1/users
/api/v2/users
\`\`\`

## 응답 형식

### 성공 응답
\`\`\`json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
\`\`\`

### 오류 응답
\`\`\`json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "이메일 형식이 올바르지 않습니다",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
\`\`\`

## 보안 고려사항

### 인증/인가
- JWT 토큰 사용
- 적절한 권한 체크
- Rate Limiting 적용

### 데이터 검증
- 입력 데이터 검증
- SQL Injection 방지
- XSS 방지

## 문서화
- OpenAPI/Swagger 사용
- 예제 요청/응답 포함
- 오류 코드 문서화

이 원칙을 따라 일관성 있는 API를 설계하세요.`,
    relatedDocs: ['database-design', 'security-guide'],
    attachments: ['api-examples.json'],
    readCount: 89,
    likes: 23
  },
  {
    id: 'database-design',
    title: '데이터베이스 설계 가이드',
    category: 'da',
    type: 'data-acquisition',
    tags: ['database', 'sql', 'design', 'performance', 'optimization'],
    author: 'DBA팀',
    assignees: ['장혜진', '윤도현', '신예림'],
    createdAt: '2024-01-20',
    updatedAt: '2024-11-15',
    status: 'completed',
    version: '1.3',
    description: '효율적인 데이터베이스 스키마 설계를 위한 가이드라인',
    content: `# 데이터베이스 설계 가이드

## 정규화 원칙

### 제1정규형 (1NF)
- 각 컬럼은 원자값을 가져야 함
- 반복되는 그룹 제거

### 제2정규형 (2NF)
- 1NF를 만족하고
- 부분적 함수 종속 제거

### 제3정규형 (3NF)
- 2NF를 만족하고
- 이행적 함수 종속 제거

## 네이밍 컨벤션

### 테이블명
- 소문자 사용
- 단수형 사용
- 언더스코어로 단어 구분

\`\`\`sql
-- Good
user
order_item
product_category

-- Bad
Users
OrderItems
ProductCategory
\`\`\`

### 컬럼명
- 소문자 사용
- 의미있는 이름 사용
- 약어 지양

\`\`\`sql
-- Good
user_id
first_name
created_at

-- Bad
uid
fname
dt
\`\`\`

## 인덱스 설계

### 기본 원칙
- WHERE 절에 자주 사용되는 컬럼
- JOIN에 사용되는 컬럼
- ORDER BY에 사용되는 컬럼

### 복합 인덱스
- 카디널리티가 높은 컬럼을 앞에
- 자주 함께 사용되는 컬럼들

\`\`\`sql
-- 복합 인덱스 예시
CREATE INDEX idx_user_status_created 
ON user (status, created_at);
\`\`\`

## 성능 최적화

### 쿼리 최적화
- 필요한 컬럼만 SELECT
- 적절한 WHERE 조건 사용
- LIMIT 활용

### 파티셔닝
- 대용량 테이블의 경우 고려
- 날짜 기반 파티셔닝
- 해시 파티셔닝

## 데이터 타입 선택

### 숫자형
- TINYINT: 0-255
- INT: 일반적인 정수
- BIGINT: 큰 정수
- DECIMAL: 정확한 소수

### 문자형
- VARCHAR: 가변 길이
- CHAR: 고정 길이
- TEXT: 긴 문자열

### 날짜/시간
- DATE: 날짜만
- DATETIME: 날짜와 시간
- TIMESTAMP: 타임스탬프

## 제약조건

### PRIMARY KEY
- 각 테이블마다 반드시 설정
- 자연키 vs 대리키 고려

### FOREIGN KEY
- 참조 무결성 보장
- CASCADE 옵션 신중히 사용

### UNIQUE
- 유일성 보장 필요한 컬럼
- 복합 UNIQUE 제약조건

### CHECK
- 데이터 유효성 검증
- 비즈니스 규칙 적용

## 백업 및 복구
- 정기적인 백업 스케줄
- 복구 시나리오 테스트
- 트랜잭션 로그 관리

이 가이드를 참고하여 안정적이고 효율적인 데이터베이스를 설계하세요.`,
    relatedDocs: ['api-design-principles', 'performance-tuning'],
    attachments: ['er-diagram.png', 'schema-example.sql'],
    readCount: 67,
    likes: 18
  },
  {
    id: 'security-guide',
    title: '웹 보안 가이드라인',
    category: 'network',
    type: 'infrastructure',
    tags: ['security', 'web', 'authentication', 'encryption', 'xss', 'sql-injection'],
    author: '보안팀',
    assignees: ['홍길동', '이영희'],
    createdAt: '2024-03-05',
    updatedAt: '2024-11-22',
    status: 'completed',
    version: '2.0',
    description: '웹 애플리케이션 보안을 위한 필수 가이드라인',
    content: `# 웹 보안 가이드라인

## 인증 및 인가

### 패스워드 정책
- 최소 8자 이상
- 대소문자, 숫자, 특수문자 조합
- 일정 주기 변경 권장
- 이전 패스워드 재사용 금지

### JWT 토큰 보안
- 적절한 만료 시간 설정
- Refresh Token 활용
- Secret Key 강력하게 설정
- 클라이언트 저장 방식 고려

\`\`\`javascript
// JWT 설정 예시
const token = jwt.sign(
  { userId: user.id },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);
\`\`\`

## 입력 데이터 검증

### XSS 방지
- 사용자 입력 데이터 이스케이프
- Content Security Policy 설정
- 신뢰할 수 있는 데이터만 innerHTML 사용

\`\`\`javascript
// XSS 방지 예시
const sanitizeInput = (input) => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};
\`\`\`

### SQL Injection 방지
- Prepared Statement 사용
- ORM 활용
- 입력값 검증

\`\`\`sql
-- 안전한 쿼리
SELECT * FROM users WHERE id = ?

-- 위험한 쿼리 (동적 문자열 생성 방식)
-- SELECT * FROM users WHERE id = '123'
\`\`\`

## HTTPS 설정
- 모든 통신 HTTPS 사용
- HSTS 헤더 설정
- 인증서 정기 갱신

## CORS 설정
- 필요한 도메인만 허용
- 와일드카드(*) 사용 금지
- Preflight 요청 처리

\`\`\`javascript
// CORS 설정 예시
app.use(cors({
  origin: ['https://example.com'],
  credentials: true
}));
\`\`\`

## 세션 보안
- 세션 하이재킹 방지
- 세션 고정 공격 방지
- 적절한 세션 타임아웃

## 파일 업로드 보안
- 파일 타입 검증
- 파일 크기 제한
- 업로드 경로 제한
- 실행 권한 제거

## 로깅 및 모니터링
- 보안 이벤트 로깅
- 비정상 접근 탐지
- 정기적인 보안 감사

## 의존성 관리
- 정기적인 패키지 업데이트
- 취약점 스캔
- 신뢰할 수 있는 소스 사용

## 개발 환경 보안
- 환경변수로 민감정보 관리
- .env 파일 버전 관리 제외
- 개발/운영 환경 분리

\`\`\`javascript
// 환경변수 사용 예시
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
};
\`\`\`

## 정기 보안 점검
- 펜테스트 수행
- 코드 리뷰
- 보안 교육

보안은 지속적인 과정입니다. 정기적으로 점검하고 업데이트하세요.`,
    relatedDocs: ['api-design-principles'],
    attachments: ['security-checklist.pdf'],
    readCount: 143,
    likes: 56
  },
  {
    id: 'testing-strategy',
    title: '테스트 전략 및 가이드',
    category: 'vd',
    type: 'process-development',
    tags: ['testing', 'unit-test', 'integration-test', 'e2e', 'jest', 'cypress'],
    author: 'QA팀',
    assignees: ['김현우', '박소영', '이재민'],
    createdAt: '2024-02-28',
    updatedAt: '2024-11-10',
    status: 'active',
    version: '1.2',
    description: '효과적인 소프트웨어 테스트를 위한 전략과 가이드라인',
    content: `# 테스트 전략 및 가이드

## 테스트 피라미드

### 단위 테스트 (Unit Test)
- 가장 많은 비중 (70%)
- 빠른 실행
- 개별 함수/메서드 테스트

\`\`\`javascript
// Jest 단위 테스트 예시
describe('Calculator', () => {
  test('should add two numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
  });
});
\`\`\`

### 통합 테스트 (Integration Test)
- 중간 비중 (20%)
- 컴포넌트 간 상호작용 테스트
- API 엔드포인트 테스트

\`\`\`javascript
// API 통합 테스트 예시
describe('User API', () => {
  test('should create user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'John', email: 'john@test.com' });
    
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('John');
  });
});
\`\`\`

### E2E 테스트 (End-to-End Test)
- 가장 적은 비중 (10%)
- 실제 사용자 시나리오 테스트
- 브라우저 자동화

\`\`\`javascript
// Cypress E2E 테스트 예시
describe('User Login', () => {
  it('should login successfully', () => {
    cy.visit('/login');
    cy.get('[data-cy=email]').type('user@test.com');
    cy.get('[data-cy=password]').type('password');
    cy.get('[data-cy=submit]').click();
    cy.url().should('include', '/dashboard');
  });
});
\`\`\`

## 테스트 작성 원칙

### AAA 패턴
- Arrange: 테스트 준비
- Act: 실행
- Assert: 검증

### Given-When-Then
- Given: 주어진 상황
- When: 특정 행동
- Then: 결과 확인

### FIRST 원칙
- Fast: 빠른 실행
- Independent: 독립적
- Repeatable: 반복 가능
- Self-Validating: 자체 검증
- Timely: 적시 작성

## 테스트 더블

### Mock
- 호출 검증 중심
- 외부 의존성 대체

\`\`\`javascript
// Mock 예시
const mockEmailService = {
  send: jest.fn()
};

test('should send email', () => {
  userService.createUser(userData, mockEmailService);
  expect(mockEmailService.send).toHaveBeenCalled();
});
\`\`\`

### Stub
- 응답 제공 중심
- 미리 정의된 답변 반환

\`\`\`javascript
// Stub 예시
const stubDatabase = {
  findUser: () => ({ id: 1, name: 'John' })
};
\`\`\`

### Spy
- 실제 객체 감시
- 호출 추적

## 테스트 환경 설정

### 테스트 데이터베이스
- 별도의 테스트 DB 사용
- 각 테스트 후 데이터 정리
- 트랜잭션 롤백 활용

### 환경 변수
\`\`\`javascript
// 테스트 환경 설정
if (process.env.NODE_ENV === 'test') {
  // 테스트 전용 설정
}
\`\`\`

## 코드 커버리지

### 목표 기준
- 라인 커버리지: 80% 이상
- 브랜치 커버리지: 70% 이상
- 함수 커버리지: 90% 이상

### 커버리지 도구
- Jest: JavaScript
- pytest-cov: Python
- SimpleCov: Ruby

## 테스트 자동화

### CI/CD 통합
- Pull Request 시 자동 테스트 실행
- 테스트 실패 시 배포 중단
- 테스트 리포트 생성

### 병렬 실행
- 테스트 실행 시간 단축
- 리소스 효율적 활용

## 성능 테스트

### 로드 테스트
- 예상 사용자 수 기준
- 응답 시간 측정
- 처리량 확인

### 스트레스 테스트
- 한계점 확인
- 시스템 안정성 검증

## 테스트 문서화

### 테스트 케이스 명세
- 명확한 테스트 목적
- 입력값과 기대값
- 실행 조건

### 테스트 결과 리포트
- 성공/실패 현황
- 커버리지 정보
- 성능 지표

테스트는 품질 보장의 핵심입니다. 지속적으로 개선해 나가세요.`,
    relatedDocs: ['react-best-practices'],
    attachments: ['test-report-template.xlsx'],
    readCount: 78,
    likes: 31
  },
  {
    id: 'deployment-guide',
    title: 'CI/CD 배포 가이드',
    category: 'medical-device',
    type: 'simulation-automation',
    tags: ['cicd', 'deployment', 'devops', 'automation', 'docker', 'kubernetes'],
    author: 'DevOps팀',
    assignees: ['강태현', '송미경'],
    createdAt: '2024-03-12',
    updatedAt: '2024-11-25',
    status: 'planning',
    version: '1.4',
    description: '자동화된 배포 파이프라인 구축 및 운영 가이드',
    content: `# CI/CD 배포 가이드

## CI/CD 개요

### Continuous Integration (CI)
- 코드 변경사항의 지속적 통합
- 자동화된 빌드 및 테스트
- 빠른 피드백 제공

### Continuous Deployment (CD)
- 자동화된 배포 프로세스
- 신뢰할 수 있는 릴리스
- 롤백 전략 포함

## Git 워크플로우

### GitFlow 전략
\`\`\`
main: 프로덕션 배포용
develop: 개발 통합 브랜치
feature/*: 기능 개발
release/*: 릴리스 준비
hotfix/*: 긴급 수정
\`\`\`

### 브랜치 보호 규칙
- main/develop 브랜치 직접 push 금지
- Pull Request 리뷰 필수
- 테스트 통과 후 머지

## 파이프라인 구성

### 1단계: 코드 검증
\`\`\`yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run tests
      run: npm run test:coverage
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
\`\`\`

### 2단계: 빌드 및 배포
\`\`\`yaml
# .github/workflows/cd.yml
name: CD Pipeline

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build application
      run: |
        npm ci
        npm run build
    
    - name: Deploy to staging
      run: |
        # 스테이징 환경 배포
        
    - name: Run smoke tests
      run: npm run test:smoke
    
    - name: Deploy to production
      if: success()
      run: |
        # 프로덕션 환경 배포
\`\`\`

## 환경 관리

### 환경 분리
- Development: 개발자 로컬 환경
- Staging: 통합 테스트 환경
- Production: 실제 서비스 환경

### 환경 변수 관리
\`\`\`bash
# .env.example
NODE_ENV=development
DATABASE_URL=postgresql://localhost/myapp_dev
API_KEY=your_api_key_here
\`\`\`

### 설정 파일 분리
\`\`\`javascript
// config/index.js
const config = {
  development: {
    database: {
      host: 'localhost',
      port: 5432
    }
  },
  production: {
    database: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT
    }
  }
};

module.exports = config[process.env.NODE_ENV];
\`\`\`

## 컨테이너화

### Dockerfile
\`\`\`dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
\`\`\`

### Docker Compose
\`\`\`yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - database
  
  database:
    image: postgres:14
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
\`\`\`

## 모니터링 및 로깅

### 헬스 체크
\`\`\`javascript
// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
\`\`\`

### 로깅 설정
\`\`\`javascript
// 구조화된 로깅
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
\`\`\`

## 배포 전략

### Blue-Green 배포
- 두 개의 동일한 프로덕션 환경
- 무중단 배포 가능
- 빠른 롤백

### Rolling 배포
- 점진적 인스턴스 교체
- 리소스 효율적
- 부분적 롤백 가능

### Canary 배포
- 일부 사용자에게 먼저 배포
- 점진적 트래픽 증가
- 위험 최소화

## 롤백 전략

### 자동 롤백 조건
- 헬스 체크 실패
- 오류율 증가
- 응답 시간 증가

### 수동 롤백 프로세스
\`\`\`bash
# 이전 버전으로 롤백
kubectl rollout undo deployment/myapp

# 특정 리비전으로 롤백
kubectl rollout undo deployment/myapp --to-revision=2
\`\`\`

## 성능 최적화

### 빌드 최적화
- 병렬 처리 활용
- 캐시 전략 적용
- 불필요한 의존성 제거

### 배포 시간 단축
- 스테이지별 병렬 실행
- 점진적 배포
- 사전 빌드된 이미지 활용

## 보안 고려사항

### 시크릿 관리
- 환경변수로 민감정보 관리
- 암호화된 저장소 사용
- 접근 권한 최소화

### 컨테이너 보안
- 최신 베이스 이미지 사용
- 취약점 스캔
- 실행 권한 최소화

이 가이드를 통해 안정적이고 효율적인 배포 파이프라인을 구축하세요.`,
    relatedDocs: ['security-guide', 'monitoring-guide'],
    attachments: ['pipeline-template.yml', 'deployment-checklist.pdf'],
    readCount: 95,
    likes: 38
  }
];

export const categories = [
  { id: 'all', name: '전체', icon: '🏢', count: 0 },
  { id: 'gtr', name: 'GTR', icon: '🎆', count: 0 },
  { id: 'mx', name: 'MX', icon: '📊', count: 0 },
  { id: 'vd', name: 'VD', icon: '📺', count: 0 },
  { id: 'da', name: 'DA', icon: '📈', count: 0 },
  { id: 'network', name: '네트워크', icon: '🌐', count: 0 },
  { id: 'medical-device', name: '의료기기', icon: '🏥', count: 0 }
];

export const documentTypes = [
  { id: 'all', name: '전체', icon: '📄' },
  { id: 'new-simulation', name: '신규 시뮬레이션 기법 개발', icon: '🎆' },
  { id: 'simulation-automation', name: '시뮬레이션 자동화', icon: '⚙️' },
  { id: 'ai-model-development', name: 'AI 모델 개발', icon: '🤖' },
  { id: 'platform-development', name: '플랫폼 개발&도입', icon: '🖥️' },
  { id: 'infrastructure', name: '인프라 구축&도입', icon: '🏢' },
  { id: 'data-acquisition', name: '데이터 확보', icon: '📈' },
  { id: 'process-development', name: '신규 프로세스 구축', icon: '🔄' }
];

export const statusOptions = [
  { id: 'all', name: '전체', color: '#64748b' },
  { id: 'planning', name: '계획 중', color: '#6b7280' },
  { id: 'active', name: '진행 중', color: '#f59e0b' },
  { id: 'completed', name: '완료됨', color: '#10b981' }
];
