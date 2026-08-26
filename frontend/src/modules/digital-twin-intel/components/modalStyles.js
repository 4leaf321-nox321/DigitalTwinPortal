import styled from 'styled-components';

export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 1000;
`;

export const Panel = styled.div`
  background: #fff;
  border-radius: 0.875rem;
  width: 100%;
  max-width: ${(p) => p.$wide || '38rem'};
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export const Head = styled.header`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.125rem;
  border-bottom: 1px solid #e2e8f0;

  h2 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
    color: #0f172a;
    flex: 1;
  }
`;

export const CloseBtn = styled.button`
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.125rem;

  &:hover { color: #475569; }
`;

export const Body = styled.div`
  padding: 1rem 1.125rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

export const Foot = styled.footer`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.125rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

/*
  ⚠️⚠️ **`label` 이 아니라 `div` 다**(2026-08-26 점검). `label` 은 눌리면 그 안의
     **첫 단추를 대신 누른다**(button 도 labelable 이다). 그래서 이름표 글자만 눌러도
     — 「이어 둔 우리 것」을 누르면 첫 연결이 묻지도 않고 끊기고, 「이 소식이 말하는
     기술」을 누르면 창이 닫히며 엉뚱한 기술로 튀고, 「처리 상태」를 누르면 골라 둔
     상태가 되돌아갔다. 스무 곳이 그랬다.

  ⚠️ `htmlFor` 로 묶어 둔 자리는 한 곳도 없었으므로 잃는 것은 「글자를 눌러 칸에
     초점 주기」뿐이다. 값을 지우는 이름표보다는 낫다.
*/
export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  > span {
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
  }

  input, textarea, select {
    padding: 0.4375rem 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.4375rem;
    font-size: 0.8125rem;
    color: #0f172a;
    font-family: inherit;

    &:focus { outline: none; border-color: #4f46e5; }
  }

  textarea { resize: vertical; min-height: 4rem; }
`;

export const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;

  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;

export const Hint = styled.p`
  margin: 0;
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.6;
`;

export const Warn = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.4375rem 0.5625rem;
  border-radius: 0.4375rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 0.6875rem;
  line-height: 1.6;

  svg { flex-shrink: 0; margin-top: 0.125rem; }
`;

export const PrimaryBtn = styled.button`
  padding: 0.4375rem 0.9375rem;
  border: none;
  border-radius: 0.4375rem;
  background: #4f46e5;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) { background: #4338ca; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export const GhostBtn = styled.button`
  padding: 0.4375rem 0.875rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.4375rem;
  background: #fff;
  color: #475569;
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover { background: #f8fafc; }
`;

export const Spacer = styled.div`
  flex: 1;
`;
