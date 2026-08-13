# 🚀 새 모듈 추가 가이드

## 📋 개요

이 프로젝트는 **모듈형 모놀리스(Modular Monolith)** 패턴을 사용하여 각 모듈이 완전히 독립적으로 작동하면서도 공통 리소스를 공유할 수 있도록 설계되었습니다.

## 🏗️ 프로젝트 구조

```
frontend/
├── src/
│   ├── App.jsx                  # 메인 앱 + 라우팅
│   ├── pages/
│   │   └── Home/               # 메인 허브 페이지
│   ├── modules/                # 모듈들
│   │   └── knowledge-graph/    # 예시 모듈
│   ├── shared/                 # 공통 컴포넌트/훅
│   ├── components/             # 페이지별 컴포넌트
│   └── styles/                 # 전역 스타일
├── MODULE_CREATION_GUIDE.md    # 이 문서
└── MODULE_TEMPLATE/            # 새 모듈 템플릿
```

## 🎯 모듈 설계 원칙

### ✅ **DO (권장사항)**
- **완전한 독립성**: 각 모듈은 자체적인 상태, 로직, 컴포넌트를 가져야 함
- **공통 리소스 활용**: `shared/` 폴더의 공통 컴포넌트 사용
- **일관된 구조**: 모든 모듈이 동일한 폴더 구조를 따라야 함
- **명확한 네이밍**: 모듈명과 컴포넌트명이 목적을 명확히 표현해야 함

### ❌ **DON'T (피해야 할 것)**
- **모듈 간 직접 의존성**: 다른 모듈의 컴포넌트를 직접 import 금지
- **전역 상태 오염**: 각 모듈은 자체 상태 관리
- **스타일 충돌**: 모듈별 CSS 클래스명 중복 방지

## 🛠️ 새 모듈 추가 단계별 가이드

### 📁 **1단계: 모듈 디렉토리 생성**

```bash
# 새 모듈 폴더 생성 (예: my-new-module)
modules/
└── my-new-module/
    ├── components/
    │   ├── MyNewModule/
    │   │   ├── MyNewModule.jsx
    │   │   └── MyNewModule.css
    │   └── Layout/
    ├── hooks/
    ├── utils/
    ├── data/
    └── MyNewModuleApp.jsx
```

### 🎨 **2단계: 메인 앱 컴포넌트 작성**

`modules/my-new-module/MyNewModuleApp.jsx`:
```javascript
import React from 'react';
import MyNewModule from './components/MyNewModule/MyNewModule';
import { ModalProvider } from '../../shared/components/Modal/ModalProvider';
import { useModal } from '../../shared/hooks/useModal';
import './MyNewModule.css';

function MyNewModuleApp() {
  const {
    modals,
    closeAlert,
    closeConfirm,
    showSuccess,
    showError,
    showInfo,
    askWarningConfirm
  } = useModal();

  return (
    <div className="my-new-module-app">
      <MyNewModule 
        showSuccess={showSuccess}
        showError={showError}
        showInfo={showInfo}
        askWarningConfirm={askWarningConfirm}
      />
      
      <ModalProvider
        modals={modals}
        onCloseAlert={closeAlert}
        onCloseConfirm={closeConfirm}
      />
    </div>
  );
}

export default MyNewModuleApp;
```

### 🧩 **3단계: 메인 컴포넌트 작성**

`modules/my-new-module/components/MyNewModule/MyNewModule.jsx`:
```javascript
import React, { useState } from 'react';
import './MyNewModule.css';

const MyNewModule = ({ showSuccess, showError, showInfo, askWarningConfirm }) => {
  const [data, setData] = useState(null);
  
  const handleAction = async () => {
    try {
      // 모듈별 로직 구현
      await showSuccess('작업이 성공적으로 완료되었습니다!');
    } catch (error) {
      await showError('작업 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="my-new-module">
      <header className="module-header">
        <h1>My New Module</h1>
        <p>모듈 설명을 여기에 작성하세요</p>
      </header>
      
      <main className="module-content">
        {/* 모듈별 UI 구현 */}
        <button onClick={handleAction} className="action-button">
          실행하기
        </button>
      </main>
    </div>
  );
};

export default MyNewModule;
```

### 🎨 **4단계: 스타일 작성**

`modules/my-new-module/components/MyNewModule/MyNewModule.css`:
```css
.my-new-module {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
}

.module-header {
  text-align: center;
  margin-bottom: 2rem;
}

.module-header h1 {
  color: #1B263B;
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.module-header p {
  color: #666;
  font-size: 1.1rem;
}

.module-content {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-button {
  background: #00ACC1;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.action-button:hover {
  background: #00838F;
}
```

### 🛣️ **5단계: 라우팅 추가**

`src/App.jsx`에 새 라우트 추가:
```javascript
import MyNewModuleApp from './modules/my-new-module/MyNewModuleApp';

// Routes 안에 추가
<Route path="/my-new-module" element={<MyNewModuleApp />} />
```

### 🏠 **6단계: 홈페이지에 모듈 카드 추가**

`src/pages/Home/Home.jsx`의 `modules` 배열에 추가:
```javascript
{
  id: 'my-new-module',
  title: '🆕 My New Module',
  description: '새로운 모듈에 대한 설명을 여기에 작성하세요. 이 모듈이 어떤 기능을 제공하는지 사용자에게 명확히 전달하세요.',
  status: 'development', // 'active', 'development', 'planned'
  route: '/my-new-module',
  featured: false // true로 설정하면 강조 표시
}
```

## 🎨 공통 리소스 활용 가이드

### 📦 **Shared Components**

#### Modal 시스템
```javascript
// 모달 사용 예시
import { useModal } from '../../shared/hooks/useModal';

const { showSuccess, showError, showInfo, askWarningConfirm } = useModal();

// 성공 메시지
await showSuccess('작업이 완료되었습니다!');

// 에러 메시지  
await showError('오류가 발생했습니다.');

// 정보 메시지
await showInfo('추가 정보입니다.');

// 확인 대화상자
const confirmed = await askWarningConfirm('정말로 삭제하시겠습니까?');
```

#### 스타일 변수 활용
```css
/* 공통 색상 팔레트 사용 */
.my-component {
  background: #00ACC1;    /* Primary color */
  color: #1B263B;         /* Text color */
  border-color: #ECEFF1;  /* Light gray */
}
```

## 🚀 고급 기능 구현

### 🎣 **커스텀 훅 생성**

`modules/my-new-module/hooks/useMyNewModuleData.js`:
```javascript
import { useState, useEffect } from 'react';

export const useMyNewModuleData = (initialData = null) => {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 데이터 로직 구현
      const result = await someApiCall();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!data) {
      fetchData();
    }
  }, []);

  return { data, loading, error, refetch: fetchData };
};
```

### 🛠️ **유틸리티 함수**

`modules/my-new-module/utils/myModuleUtils.js`:
```javascript
// 모듈별 유틸리티 함수들
export const formatData = (rawData) => {
  return rawData.map(item => ({
    id: item.id,
    label: item.name,
    value: item.value
  }));
};

export const validateInput = (input) => {
  if (!input || input.trim() === '') {
    return { isValid: false, message: '입력값이 필요합니다.' };
  }
  return { isValid: true, message: '' };
};
```

## 📋 체크리스트

새 모듈 추가 시 다음 사항들을 확인하세요:

### ✅ **필수 작업**
- [ ] `modules/[module-name]/` 디렉토리 생성
- [ ] `[ModuleName]App.jsx` 메인 앱 컴포넌트 작성
- [ ] 메인 컴포넌트와 스타일 파일 작성
- [ ] `App.jsx`에 라우트 추가
- [ ] `Home.jsx`에 모듈 카드 추가
- [ ] 공통 모달 시스템 통합

### 🎨 **권장 작업**
- [ ] 커스텀 훅 작성 (필요 시)
- [ ] 유틸리티 함수 작성 (필요 시)
- [ ] 샘플 데이터 준비 (필요 시)
- [ ] 반응형 디자인 적용
- [ ] 접근성 고려사항 반영

### 🧪 **테스트 작업**
- [ ] 모듈 독립성 확인 (다른 모듈에 영향 없음)
- [ ] 공통 컴포넌트 정상 작동 확인
- [ ] 라우팅 정상 작동 확인
- [ ] 반응형 디자인 테스트
- [ ] 에러 처리 테스트

## 📁 파일 관리 규칙

### 📏 **파일 크기 제한**
- **700줄 제한**: 파일이 700줄을 초과하면 리팩토링 필요
- **백업 생성**: 리팩토링 시 `filename.backup[YYYYMMDD]` 형식으로 백업

### 🗂️ **네이밍 컨벤션**
```
모듈명: kebab-case (my-new-module)
컴포넌트: PascalCase (MyNewModule)
파일명: PascalCase.jsx (MyNewModule.jsx)
CSS 클래스: kebab-case (my-new-module)
```

## 🎯 실제 구현 예시

Knowledge Graph 모듈을 참고하여 구조를 파악하세요:

```
modules/knowledge-graph/
├── components/
│   ├── DataPanel/           # 데이터 정보 패널
│   ├── KnowledgeGraph/      # 메인 그래프 컴포넌트
│   └── Layout/              # 레이아웃 컴포넌트
├── hooks/                   # 8개의 커스텀 훅
├── utils/                   # 유틸리티 함수들
├── data/                    # 샘플 데이터
└── KnowledgeGraphApp.jsx    # 메인 앱 컴포넌트
```

## 🆘 문제 해결

### 🐛 **일반적인 문제들**

1. **Import 경로 오류**
   - 상대 경로 확인: `../../shared/components/Modal`
   - 절대 경로는 src 기준으로 설정

2. **스타일 충돌**
   - 모듈별 고유한 CSS 클래스명 사용
   - CSS 모듈 활용 고려

3. **모달 시스템 오류**
   - ModalProvider 누락 확인
   - useModal 훅 올바른 사용법 확인

## 🎉 완성!

이 가이드를 따라하면 완전히 독립적이면서도 일관된 새 모듈을 추가할 수 있습니다.

---

💡 **팁**: Knowledge Graph 모듈의 코드를 참고하여 구체적인 구현 방법을 학습하세요!
🔄 **업데이트**: 새로운 패턴이나 개선사항이 생기면 이 가이드를 업데이트하세요.
