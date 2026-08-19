import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import {
  Overlay, Modal, ModalHeader, ModalTitle, CloseButton, ModalBody,
  ModalFooter, FooterRight, HelpText, CancelButton, SaveButton,
} from './modalStyles';
import { CATEGORY1_OPTIONS } from '../constants';

const Section = styled.div`
  & + & { margin-top: 24px; }
`;

const SectionTitle = styled.h4`
  margin: 0 0 6px 0;
  font-size: 0.9rem;
  color: #1e293b;
`;

const SectionHelp = styled.p`
  margin: 0 0 12px 0;
  font-size: 0.78rem;
  color: #94a3b8;
  line-height: 1.5;
`;

const FixedList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const FixedChip = styled.span`
  padding: 4px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 0.8rem;
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
`;

const Handle = styled.span`
  display: flex;
  color: #cbd5e1;
`;

const ItemInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.85rem;
  color: #1e293b;
  background: transparent;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  border-radius: 4px;
  &:hover { color: #ef4444; background: #fef2f2; }
`;

const AddRow = styled.div`
  display: flex;
  gap: 8px;
`;

const NewInput = styled.input`
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #1e293b;
  outline: none;
  &:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15); }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #4f46e5;
  color: white;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  &:hover { background: #4338ca; }
  &:disabled { background: #cbd5e1; cursor: not-allowed; }
`;

const Warning = styled.div`
  font-size: 0.78rem;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 8px 10px;
  margin-top: 10px;
`;

const SettingsModal = ({ isOpen, onClose, onSave, category2Options = [], usedCategory2 = [] }) => {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setItems([...category2Options]);
    setDraft('');
  }, [isOpen, category2Options]);

  if (!isOpen) return null;

  const trimmedDraft = draft.trim();
  const canAdd = trimmedDraft.length > 0 && !items.includes(trimmedDraft);

  const handleAdd = () => {
    if (!canAdd) return;
    setItems(prev => [...prev, trimmedDraft]);
    setDraft('');
  };

  const handleRename = (idx, value) => {
    setItems(prev => prev.map((v, i) => (i === idx ? value : v)));
  };

  // 이미 투자 건이 쓰고 있는 값을 지우면 그 건의 디지털 트윈 영역은 목록에 없는 값이 된다.
  // 지우지 못하게 막는 대신 무엇이 걸리는지만 알려 준다.
  const removedInUse = usedCategory2.filter(
    v => category2Options.includes(v) && !items.map(s => s.trim()).includes(v)
  );

  const handleSave = async () => {
    const cleaned = [...new Set(items.map(v => v.trim()).filter(Boolean))];
    setSaving(true);
    try {
      await onSave(cleaned);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Modal $width="520px">
        <ModalHeader>
          <ModalTitle>투자 현황 설정</ModalTitle>
          <CloseButton onClick={onClose}><X size={18} /></CloseButton>
        </ModalHeader>

        <ModalBody>
          <Section>
            <SectionTitle>디지털 트윈 영역</SectionTitle>
            <SectionHelp>
              투자 등록 화면의 디지털 트윈 영역 선택지입니다. 여기서 늘리거나 이름을 고칠 수 있습니다.
            </SectionHelp>

            <ItemList>
              {items.map((item, idx) => (
                <Item key={idx}>
                  <Handle><GripVertical size={14} /></Handle>
                  <ItemInput
                    value={item}
                    onChange={e => handleRename(idx, e.target.value)}
                    placeholder="디지털 트윈 영역이름"
                  />
                  <RemoveButton
                    onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </RemoveButton>
                </Item>
              ))}
            </ItemList>

            <AddRow>
              <NewInput
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="새 디지털 트윈 영역 추가"
              />
              <AddButton onClick={handleAdd} disabled={!canAdd}>
                <Plus size={14} /> 추가
              </AddButton>
            </AddRow>

            {removedInUse.length > 0 && (
              <Warning>
                「{removedInUse.join('」, 「')}」 은(는) 이미 등록된 투자 건이 쓰고 있습니다.
                지운 뒤에도 그 건의 값은 그대로 남지만, 새로 고를 수는 없게 됩니다.
              </Warning>
            )}
          </Section>

          <Section>
            <SectionTitle>투자 유형</SectionTitle>
            <SectionHelp>
              투자 유형은 고정 목록이라 화면에서 바꾸지 않습니다.
            </SectionHelp>
            <FixedList>
              {CATEGORY1_OPTIONS.map(name => <FixedChip key={name}>{name}</FixedChip>)}
            </FixedList>
          </Section>
        </ModalBody>

        <ModalFooter>
          <HelpText>디지털 트윈 영역 {items.filter(v => v.trim()).length}개</HelpText>
          <FooterRight>
            <CancelButton onClick={onClose}>취소</CancelButton>
            <SaveButton onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </SaveButton>
          </FooterRight>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default SettingsModal;
