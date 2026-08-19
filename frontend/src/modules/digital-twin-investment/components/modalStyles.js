/**
 * 투자 현황 모듈의 세 모달(단건 등록 / 일괄 등록 / 설정)이 함께 쓰는 껍데기 스타일.
 * 같은 모양을 세 번 적지 않으려고 한곳에 모았다.
 */
import styled from 'styled-components';

export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

export const Modal = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  width: ${props => props.$width || '560px'};
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
`;

export const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: #1e293b;
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #64748b;
  display: flex;
  align-items: center;
  border-radius: 4px;
  &:hover { background: #e2e8f0; color: #1e293b; }
`;

export const ModalBody = styled.div`
  flex: 1;
  overflow: auto;
  padding: 20px;
`;

export const ModalFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

export const FooterRight = styled.div`
  display: flex;
  gap: 10px;
  margin-left: auto;
`;

export const HelpText = styled.div`
  font-size: 0.78rem;
  color: #94a3b8;
`;

export const CancelButton = styled.button`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  &:hover { background: #f1f5f9; }
`;

export const SaveButton = styled.button`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: #4f46e5;
  color: white;
  &:hover { background: #4338ca; }
  &:disabled { background: #cbd5e1; cursor: not-allowed; }
`;
