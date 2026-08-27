import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, Check, Pencil, AlertTriangle } from 'lucide-react';
import maturityApi from '../../services/maturityApi';

// 시험 항목 / 시뮬레이션 관리 — 한 모달, 두 종류. (PLAN 7-5)
//
// 목록 화면 본문은 쌍과 가져오기에 집중하고, 항목 자체의 추가·수정·삭제는 여기서 한다.
// ⚠️ 지우면 걸린 쌍·평가·이력이 같이 간다 — 확인 문구에 그 수를 넣는다.

const Backdrop = styled.div`
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1.5rem;
`;
const Panel = styled.div`
  background: white; border-radius: 0.75rem; width: min(760px, 100%); max-height: 88vh;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; overflow: hidden;
`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 1rem 1.25rem 0.75rem; border-bottom: 1px solid #e2e8f0;`;
const Title = styled.h3`margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b;`;
const Count = styled.span`font-size: 0.8125rem; color: #94a3b8;`;
const CloseButton = styled.button`
  margin-left: auto; border: none; background: transparent; color: #94a3b8; cursor: pointer;
  padding: 0.25rem; border-radius: 0.25rem; &:hover { color: #475569; background: #f1f5f9; }
`;
const Body = styled.div`overflow-y: auto; flex: 1;`;
const Row = styled.div`
  display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 1.25rem; border-bottom: 1px solid #f1f5f9;
  font-size: 0.8125rem; &:hover { background: #fafafa; }
`;
const Name = styled.span`flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Sub = styled.span`color: #94a3b8; font-size: 0.75rem; white-space: nowrap;`;
const Icon = styled.button`
  border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0.15rem; border-radius: 0.25rem;
  &:hover { color: ${p => (p.$danger ? '#b91c1c' : '#1d4ed8')}; background: ${p => (p.$danger ? '#fef2f2' : '#eff6ff')}; }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
`;
const Form = styled.form`display: flex; gap: 0.4rem; padding: 0.6rem 1.25rem; border-top: 1px solid #e2e8f0; flex-wrap: wrap; background: #f8fafc;`;
const Input = styled.input`
  padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem;
  flex: ${p => (p.$grow ? 1 : 'none')}; min-width: 0; width: ${p => p.$w || 'auto'};
`;
const Select = styled.select`padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem;`;
const Button = styled.button`
  padding: 0.35rem 0.7rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: white; color: #475569;
  font-size: 0.8125rem; font-weight: 600; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;
  &:hover:not(:disabled) { border-color: #1d4ed8; color: #1d4ed8; } &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const Notice = styled.div`
  display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.6rem 0.75rem; margin: 0.5rem 1.25rem; border-radius: 0.5rem;
  background: ${p => (p.$bad ? '#fef2f2' : '#fffbeb')}; border: 1px solid ${p => (p.$bad ? '#fecaca' : '#fde68a')};
  color: ${p => (p.$bad ? '#991b1b' : '#92400e')}; font-size: 0.8125rem; line-height: 1.5;
`;
const Empty = styled.div`padding: 1.25rem; color: #94a3b8; font-size: 0.8125rem;`;

const KINDS = {
  subject: {
    title: '시험 항목 관리',
    blank: { name: '', detail: '', product_families: '' },
    hint: '로드맵의 시험 항목과 같은 이름을 쓰면 어긋남 셈이 맞습니다.',
  },
  agent: {
    title: '시뮬레이션 관리',
    blank: { name: '', kind: '', model_kind: '' },
    hint: '시뮬레이션은 엑셀 행 단위 — 정확도가 그 단위로 나옵니다. 과제 단위로 묶지 마세요.',
  },
};

const ItemManagerModal = ({ kind, divisionId, items, pairCount, canEdit, denyReason, modelKinds = [], onClose, onChanged }) => {
  const meta = KINDS[kind];
  const [draft, setDraft] = useState(meta.blank);
  const [editing, setEditing] = useState(null);     // { id, ...fields }
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const api = kind === 'subject'
    ? { create: maturityApi.createSubject, update: maturityApi.updateSubject, remove: maturityApi.deleteSubject }
    : { create: maturityApi.createAgent, update: maturityApi.updateAgent, remove: maturityApi.deleteAgent };

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); setError(null); onChanged(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const normalize = (f) => (kind === 'agent' ? { ...f, model_kind: f.model_kind || null } : f);

  const add = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    run(async () => { await api.create({ division_id: divisionId, ...normalize(draft) }); setDraft(meta.blank); });
  };
  const save = () => {
    if (!editing?.name?.trim()) return;
    const { id, ...fields } = editing;
    run(async () => { await api.update(id, normalize(fields)); setEditing(null); });
  };
  const remove = (item) => {
    const n = pairCount[item.id] || 0;
    if (!window.confirm(`「${item.name}」을 지웁니다. 걸린 쌍 ${n}개와 그 평가·이력이 같이 사라집니다.`)) return;
    run(() => api.remove(item.id));
  };
  const startEdit = (item) => setEditing(kind === 'subject'
    ? { id: item.id, name: item.name, detail: item.detail || '', product_families: (item.product_families || []).join(', ') }
    : { id: item.id, name: item.name, kind: item.kind || '', model_kind: item.model_kind || '' });

  const fields = (value, set) => (kind === 'subject' ? (
    <>
      <Input $grow placeholder="시험 항목" value={value.name} onChange={e => set({ name: e.target.value })} />
      <Input $w="8rem" placeholder="세부" value={value.detail} onChange={e => set({ detail: e.target.value })} />
      <Input $w="11rem" placeholder="적용 제품군 (쉼표)" value={value.product_families} onChange={e => set({ product_families: e.target.value })} />
    </>
  ) : (
    <>
      <Input $grow placeholder="시뮬레이션 (엑셀 행 단위)" value={value.name} onChange={e => set({ name: e.target.value })} />
      <Input $w="7rem" placeholder="종류 (구조·열·…)" value={value.kind} onChange={e => set({ kind: e.target.value })} />
      <Select value={value.model_kind} onChange={e => set({ model_kind: e.target.value })}>
        <option value="">모델 종류</option>
        {modelKinds.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
      </Select>
    </>
  ));

  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <Head>
          <Title>{meta.title}</Title>
          <Count>{items.length}개</Count>
          <CloseButton onClick={onClose} title="닫기"><X size={18} /></CloseButton>
        </Head>
        {error && <Notice $bad><AlertTriangle size={14} /> <span>{error}</span></Notice>}
        {denyReason && <Notice><AlertTriangle size={14} /> <span>{denyReason} 조회는 그대로 하실 수 있습니다.</span></Notice>}
        <Body>
          {items.length === 0 && <Empty>아직 없습니다. {canEdit ? '아래에서 추가하거나 가져오기로 넣으세요.' : ''}</Empty>}
          {items.map(item => (
            editing?.id === item.id ? (
              <Row key={item.id}>
                {fields(editing, (patch) => setEditing(s => ({ ...s, ...patch })))}
                <Icon title="저장" disabled={busy} onClick={save}><Check size={15} /></Icon>
                <Icon title="취소" onClick={() => setEditing(null)}><X size={15} /></Icon>
              </Row>
            ) : (
              <Row key={item.id}>
                <Name title={kind === 'subject' ? (item.detail || '') : (item.kind || '')}>
                  {item.name}
                  {kind === 'subject' && item.detail && <Sub> {item.detail}</Sub>}
                  {kind === 'agent' && item.kind && <Sub> {item.kind}</Sub>}
                </Name>
                {kind === 'subject' && (item.product_families || []).length > 0 && <Sub>{item.product_families.join(', ')}</Sub>}
                {kind === 'agent' && item.model_kind && <Sub>{modelKinds.find(m => m.key === item.model_kind)?.label || item.model_kind}</Sub>}
                <Sub>쌍 {pairCount[item.id] || 0}</Sub>
                <Icon title="수정" disabled={!canEdit || busy} onClick={() => startEdit(item)}><Pencil size={14} /></Icon>
                <Icon $danger title="지우기 — 걸린 쌍·평가가 같이 사라집니다" disabled={!canEdit || busy} onClick={() => remove(item)}><Trash2 size={14} /></Icon>
              </Row>
            )
          ))}
        </Body>
        {canEdit && (
          <Form onSubmit={add}>
            {fields(draft, (patch) => setDraft(s => ({ ...s, ...patch })))}
            <Button type="submit" disabled={busy || !draft.name.trim()}><Plus size={13} /> 추가</Button>
            <Sub style={{ flexBasis: '100%' }}>{meta.hint}</Sub>
          </Form>
        )}
      </Panel>
    </Backdrop>
  );
};

export default ItemManagerModal;
