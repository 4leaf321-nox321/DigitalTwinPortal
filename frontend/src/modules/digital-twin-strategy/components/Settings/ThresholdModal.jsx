import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, RotateCcw } from 'lucide-react';

// 진단 임계값 설정.
//
// 어느 값이 맞는지는 실제 데이터를 봐야 알 수 있고, 그 판단은 운영에서 이뤄진다.
// 코드에만 두면 조정할 때마다 배포가 필요해 반복이 끊긴다.

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
`;

const Panel = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: min(640px, 100%);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.125rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const CloseButton = styled.button`
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  &:hover { color: #475569; background: #f1f5f9; }
`;

const Body = styled.div`
  padding: 1rem 1.25rem;
  overflow-y: auto;
`;

const Intro = styled.p`
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.6;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 110px 34px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid #f1f5f9;
  &:last-child { border-bottom: none; }
`;

const Label = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
`;

const Detail = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.15rem;
  line-height: 1.5;
`;

const Changed = styled.span`
  margin-left: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #7c3aed;
`;

const InputWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const Input = styled.input`
  width: 72px;
  padding: 0.4rem 0.55rem;
  border: 1px solid ${p => (p.$dirty ? '#c4b5fd' : '#e2e8f0')};
  background: ${p => (p.$dirty ? '#faf5ff' : 'white')};
  border-radius: 0.375rem;
  font-size: 0.875rem;
  text-align: right;
  color: #334155;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const Unit = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const ResetButton = styled.button`
  border: none;
  background: transparent;
  color: ${p => (p.$active ? '#94a3b8' : '#e2e8f0')};
  cursor: ${p => (p.$active ? 'pointer' : 'default')};
  padding: 0.25rem;
  border-radius: 0.25rem;
  &:hover { color: ${p => (p.$active ? '#7c3aed' : '#e2e8f0')}; }
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid #e2e8f0;
`;

const Note = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;
  &:hover { border-color: #cbd5e1; }
`;

const PrimaryButton = styled(Button)`
  border: none;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  &:hover { box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); }
`;

const ErrorBox = styled.div`
  margin-bottom: 0.75rem;
  padding: 0.6rem 0.85rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  color: #b91c1c;
  font-size: 0.8125rem;
`;

const ThresholdModal = ({ definitions, values, onSave, onClose }) => {
  const [draft, setDraft] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = {};
    (definitions || []).forEach(d => {
      next[d.key] = String(values?.[d.key] ?? d.default);
    });
    setDraft(next);
  }, [definitions, values]);

  const isDirty = (d) => Number(draft[d.key]) !== d.default;

  const save = async () => {
    setError(null);
    const payload = {};
    for (const d of definitions || []) {
      const raw = String(draft[d.key] ?? '').trim();
      if (raw === '') {
        setError(`${d.label} 을(를) 비울 수 없습니다.`);
        return;
      }
      const n = Number(raw);
      if (Number.isNaN(n)) {
        setError(`${d.label} 은(는) 숫자여야 합니다.`);
        return;
      }
      payload[d.key] = n;
    }
    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const changedCount = (definitions || []).filter(isDirty).length;

  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <Head>
          <Title>진단 임계값</Title>
          <CloseButton onClick={onClose}><X size={18} /></CloseButton>
        </Head>

        <Body>
          <Intro>
            이 값을 넘으면 "짚인 것"에 나옵니다. 너무 느슨하면 아무것도 안 걸리고,
            너무 빡빡하면 전부 걸려 정작 중요한 것이 묻힙니다.
            기본값과 다른 항목만 저장되므로, 나중에 기본값이 바뀌면 손대지 않은
            항목은 새 기본값을 따라갑니다.
          </Intro>

          {error && <ErrorBox>{error}</ErrorBox>}

          {(definitions || []).map(d => (
            <Row key={d.key}>
              <div>
                <Label>
                  {d.label}
                  {isDirty(d) && <Changed>변경됨</Changed>}
                </Label>
                <Detail>{d.detail}</Detail>
              </div>
              <InputWrap>
                <Input
                  type="number"
                  $dirty={isDirty(d)}
                  value={draft[d.key] ?? ''}
                  onChange={e => setDraft(v => ({ ...v, [d.key]: e.target.value }))}
                />
                <Unit>{d.unit}</Unit>
              </InputWrap>
              <ResetButton
                $active={isDirty(d)}
                onClick={() => isDirty(d) && setDraft(v => ({ ...v, [d.key]: String(d.default) }))}
                title={isDirty(d) ? `기본값(${d.default}${d.unit})으로 되돌리기` : '기본값입니다'}
              >
                <RotateCcw size={15} />
              </ResetButton>
            </Row>
          ))}
        </Body>

        <Foot>
          <Note>
            {changedCount ? `기본값과 다른 항목 ${changedCount}개` : '전부 기본값입니다'}
          </Note>
          <Actions>
            <Button onClick={onClose}>취소</Button>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </PrimaryButton>
          </Actions>
        </Foot>
      </Panel>
    </Backdrop>
  );
};

export default ThresholdModal;
