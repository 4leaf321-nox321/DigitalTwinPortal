import { useState, useCallback } from 'react';

export const useModal = () => {
  const [modals, setModals] = useState({
    alert: { isOpen: false, props: {} },
    confirm: { isOpen: false, props: {}, resolve: null }
  });

  const showAlert = useCallback(({ title, message, type = 'info' }) => {
    return new Promise((resolve) => {
      setModals(prev => ({
        ...prev,
        alert: {
          isOpen: true,
          props: { title, message, type },
          resolve
        }
      }));
    });
  }, []);

  const showConfirm = useCallback(({ title, message, type = 'question', confirmText = '확인', cancelText = '취소', destructive = false }) => {
    return new Promise((resolve) => {
      setModals(prev => ({
        ...prev,
        confirm: {
          isOpen: true,
          props: { title, message, type, confirmText, cancelText, destructive },
          resolve
        }
      }));
    });
  }, []);

  const closeAlert = useCallback(() => {
    const { resolve } = modals.alert;
    setModals(prev => ({
      ...prev,
      alert: { isOpen: false, props: {}, resolve: null }
    }));
    if (resolve) resolve();
  }, [modals.alert]);

  const closeConfirm = useCallback((result) => {
    const { resolve } = modals.confirm;
    setModals(prev => ({
      ...prev,
      confirm: { isOpen: false, props: {}, resolve: null }
    }));
    if (resolve) resolve(result);
  }, [modals.confirm]);

  // 편의 메서드들
  const showSuccess = useCallback((message, title = '성공') => {
    return showAlert({ title, message, type: 'success' });
  }, [showAlert]);

  const showWarning = useCallback((message, title = '경고') => {
    return showAlert({ title, message, type: 'warning' });
  }, [showAlert]);

  const showError = useCallback((message, title = '오류') => {
    return showAlert({ title, message, type: 'error' });
  }, [showAlert]);

  const showInfo = useCallback((message, title = '정보') => {
    return showAlert({ title, message, type: 'info' });
  }, [showAlert]);

  const askConfirm = useCallback((message, title = '확인') => {
    return showConfirm({ title, message, type: 'question' });
  }, [showConfirm]);

  const askWarningConfirm = useCallback((message, title = '경고', destructive = true) => {
    return showConfirm({ title, message, type: 'warning', destructive });
  }, [showConfirm]);

  return {
    modals,
    closeAlert,
    closeConfirm,
    showAlert,
    showConfirm,
    showSuccess,
    showWarning, 
    showError,
    showInfo,
    askConfirm,
    askWarningConfirm
  };
};