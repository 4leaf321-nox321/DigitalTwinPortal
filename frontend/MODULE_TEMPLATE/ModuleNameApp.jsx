import React from 'react';
import ModuleName from './components/ModuleName/ModuleName';
import { ModalProvider } from '../../shared/components/Modal/ModalProvider';
import { useModal } from '../../shared/hooks/useModal';
import './ModuleNameApp.css';

/**
 * [MODULE_NAME] 메인 앱 컴포넌트
 * 
 * 사용법:
 * 1. 모든 [MODULE_NAME]을 실제 모듈명으로 변경 (예: MyAwesomeModule)
 * 2. 파일명을 ModuleNameApp.jsx에서 실제 이름으로 변경
 * 3. CSS 파일명도 함께 변경
 * 4. components/ModuleName 폴더명도 변경
 */
function ModuleNameApp() {
  const {
    modals,
    closeAlert,
    closeConfirm,
    showSuccess,
    showError,
    showInfo,
    askWarningConfirm
  } = useModal();

  console.log('🚀 [MODULE_NAME] 앱 초기화');

  return (
    <div className="module-name-app">
      <ModuleName 
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

export default ModuleNameApp;
