import React from 'react';
import AlertModal from './AlertModal';
import ConfirmModal from './ConfirmModal';

const ModalProvider = ({ modals, onCloseAlert, onCloseConfirm }) => {
  return (
    <>
      <AlertModal
        isOpen={modals.alert.isOpen}
        onClose={onCloseAlert}
        {...modals.alert.props}
      />
      
      <ConfirmModal
        isOpen={modals.confirm.isOpen}
        onClose={() => onCloseConfirm(false)}
        onConfirm={onCloseConfirm}
        {...modals.confirm.props}
      />
    </>
  );
};

export default ModalProvider;