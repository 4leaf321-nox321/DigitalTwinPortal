# 📋 새 모듈 템플릿 사용 가이드

이 템플릿을 사용하여 새로운 모듈을 빠르고 일관되게 생성할 수 있습니다.

## 🚀 빠른 시작

### 1. 템플릿 복사
```bash
# MODULE_TEMPLATE 폴더를 새 모듈명으로 복사
cp -r MODULE_TEMPLATE modules/your-new-module
```

### 2. 파일명 변경
```
ModuleNameApp.jsx → YourNewModuleApp.jsx
ModuleNameApp.css → YourNewModuleApp.css
components/ModuleName/ → components/YourNewModule/
```

### 3. 코드에서 플레이스홀더 교체

다음 문자들을 실제 모듈명으로 교체하세요:

- `[MODULE_NAME]` → `Your New Module`
- `ModuleName` → `YourNewModule`  
- `module-name` → `your-new-module`

### 4. App.jsx에 라우트 추가
```javascript
import YourNewModuleApp from './modules/your-new-module/YourNewModuleApp';

<Route path="/your-new-module" element={<YourNewModuleApp />} />
```

### 5. Home.jsx에 모듈 카드 추가
```javascript
{
  id: 'your-new-module',
  title: '🆕 Your New Module',
  description: '모듈 설명...',
  status: 'development',
  route: '/your-new-module'
}
```

## 📁 템플릿 구조

```
MODULE_TEMPLATE/
├── ModuleNameApp.jsx          # 메인 앱 컴포넌트
├── ModuleNameApp.css          # 앱 전역 스타일
├── components/
│   └── ModuleName/
│       ├── ModuleName.jsx     # 메인 컴포넌트
│       └── ModuleName.css     # 컴포넌트 스타일
├── hooks/
│   └── useModuleData.js       # 데이터 관리 훅
├── utils/
│   └── moduleUtils.js         # 유틸리티 함수들
├── data/
│   └── sampleData.js          # 샘플 데이터
└── README_TEMPLATE.md         # 이 파일
```

## 🎯 주요 특징

### ✅ 포함된 기능들
- **모달 시스템** 통합 (성공/에러/확인 메시지)
- **반응형 디자인** 준비
- **로딩 상태** 관리
- **에러 처리** 구조
- **샘플 데이터** 제공
- **유틸리티 함수** 모음
- **커스텀 훅** 예시
- **일관된 스타일링**

### 🎨 스타일 특징
- CSS 변수를 통한 테마 관리
- 모바일 반응형 지원
- 애니메이션 효과
- 접근성 고려사항

## 🛠️ 커스터마이징

### 색상 변경
`ModuleNameApp.css`의 CSS 변수 수정:
```css
--module-primary-color: #00ACC1;
--module-secondary-color: #1B263B;
```

### 컴포넌트 추가
```
components/
├── ModuleName/
├── NewComponent/
│   ├── NewComponent.jsx
│   └── NewComponent.css
```

### 훅 추가
```
hooks/
├── useModuleData.js
├── useNewHook.js
```

## 📝 주의사항

1. **파일명과 클래스명 일치**: CSS 클래스는 컴포넌트명과 일치시키세요
2. **모듈 독립성 유지**: 다른 모듈을 직접 import하지 마세요
3. **공통 리소스 활용**: `shared/` 폴더의 컴포넌트를 적극 활용하세요
4. **700줄 제한**: 파일이 700줄을 넘으면 리팩토링하세요
5. **백업 생성**: 리팩토링 시 `.backup[날짜]` 형식으로 백업하세요

## 🎉 완료!

템플릿을 사용하여 새 모듈을 만드셨다면, 다음을 확인하세요:

- [ ] 모든 플레이스홀더가 교체되었나요?
- [ ] 라우팅이 정상 작동하나요?
- [ ] 홈페이지에 모듈 카드가 표시되나요?
- [ ] 모달 시스템이 작동하나요?
- [ ] 반응형 디자인이 적용되나요?

---
💡 **팁**: Knowledge Graph 모듈을 참고하여 더 복잡한 기능을 구현해보세요!
