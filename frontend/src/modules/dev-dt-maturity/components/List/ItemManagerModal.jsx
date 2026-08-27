import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, Loader2, AlertTriangle, Link2 } from 'lucide-react';
import maturityApi from '../../services/maturityApi';

// 시험 항목 / 시뮬레이션 관리 — 왼쪽 목록, 오른쪽 상세. 인텔의 역량 관리와 같은 꼴.
//
//   왼쪽 위   이름만 적고 Enter → 바로 생기고 골라진다 (나머지는 오른쪽에서)
//   왼쪽     목록 — 누르면 오른쪽에 상세
//   오른쪽   그 항목의 칸들. 고치면 저장이 켜진다
//
// ⚠️ 지우면 걸린 쌍·평가·이력이 같이 간다 — 확인 문구에 그 수를 넣는다.
// ⚠️ 이름표는 label 이 아니라 div 다(인텔 점검 2026-08-26 — label 은 안의 첫 단추를 대신 누른다).

const Overlay = styled.div`
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1.5rem;
`;
const Panel = styled.div`
  background: white; border-radius: 0.75rem; width: min(70rem, 94vw); height: min(40rem, 86vh);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; overflow: hidden;
`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.875rem 1.125rem; border-bottom: 1px solid #e2e8f0;`;
const Title = styled.h3`margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b;`;
const Count = styled.span`font-size: 0.8125rem; color: #94a3b8;`;
const CloseButton = styled.button`
  margin-left: auto; border: none; background: transparent; color: #94a3b8; cursor: pointer;
  padding: 0.25rem; border-radius: 0.25rem; &:hover { color: #475569; background: #f1f5f9; }
`;
const Two = styled.div`
  flex: 1; min-height: 0; display: grid; grid-template-columns: 20rem 1fr;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;
const Left = styled.div`border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; min-height: 0;`;
const NewRow = styled.div`
  border-bottom: 1px solid #e2e8f0; padding: 0.5rem; display: flex; gap: 0.25rem; background: #f8fafc;
  input { flex: 1; min-width: 0; font-size: 0.8125rem; padding: 0.35rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.3125rem; font-family: inherit; }
  button {
    border: none; background: #1d4ed8; color: #fff; border-radius: 0.3125rem; padding: 0 0.625rem; cursor: pointer;
    display: inline-flex; align-items: center; &:disabled { background: #bfdbfe; cursor: not-allowed; }
  }
`;
const List = styled.div`flex: 1; min-height: 0; overflow-y: auto; padding: 0.5rem;`;
const Pick = styled.button`
  width: 100%; text-align: left; border: 1px solid ${p => (p.$on ? '#93c5fd' : 'transparent')};
  background: ${p => (p.$on ? '#eff6ff' : 'transparent')}; border-radius: 0.375rem; padding: 0.3125rem 0.4375rem;
  cursor: pointer; display: flex; align-items: center; gap: 0.375rem; font: inherit;
  &:hover { background: #f1f5f9; }
  b { flex: 1; min-width: 0; font-size: 0.8125rem; font-weight: ${p => (p.$on ? 700 : 400)}; color: #0f172a;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  em { font-style: normal; font-size: 0.6875rem; color: #94a3b8; font-variant-numeric: tabular-nums;
       display: inline-flex; align-items: center; gap: 0.125rem; }
`;
const Quiet = styled.em`color: #f59e0b !important;`;
const Right = styled.div`min-height: 0; overflow-y: auto; padding: 0.875rem 1rem; display: flex; flex-direction: column; gap: 0.75rem;`;
const Field = styled.div`
  display: flex; flex-direction: column; gap: 0.25rem;
  > span { font-size: 0.6875rem; font-weight: 700; color: #64748b; }
  input, select, textarea {
    font-size: 0.8125rem; padding: 0.4rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit;
    &:disabled { background: #f8fafc; color: #64748b; }
  }
  small { font-size: 0.6875rem; color: #94a3b8; }
`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center;`;
const Chip = styled.span`
  display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; background: #eff6ff; color: #1e40af;
  border: 1px solid #bfdbfe; border-radius: 999px; padding: 0.15rem 0.3rem 0.15rem 0.55rem;
  button { border: none; background: transparent; color: #60a5fa; cursor: pointer; padding: 0; display: inline-flex; &:hover { color: #1d4ed8; } }
`;
const ChipAdd = styled.div`
  display: flex; gap: 0.25rem; align-items: center;
  input { font-size: 0.75rem; padding: 0.25rem 0.4rem; border: 1px dashed #cbd5e1; border-radius: 999px; font-family: inherit; width: 11rem; }
  button { border: none; background: #1d4ed8; color: #fff; border-radius: 999px; width: 1.4rem; height: 1.4rem; cursor: pointer;
           display: inline-flex; align-items: center; justify-content: center; &:disabled { background: #bfdbfe; cursor: not-allowed; } }
`;
const Pair = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; @media (max-width: 700px) { grid-template-columns: 1fr; }`;
const Info = styled.div`
  font-size: 0.75rem; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.5rem 0.625rem; line-height: 1.6;
`;
const Foot = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1rem; border-top: 1px solid #e2e8f0; background: #f8fafc;`;
const Note = styled.small`font-size: 0.6875rem; color: #64748b;`;
const Save = styled.button`
  border: none; background: #1d4ed8; color: #fff; font-weight: 600; font-size: 0.8125rem; padding: 0.4375rem 0.9375rem;
  border-radius: 0.375rem; cursor: pointer; font-family: inherit; &:disabled { background: #bfdbfe; cursor: not-allowed; }
`;
const Ghost = styled.button`
  border: 1px solid #e2e8f0; background: #fff; color: #64748b; font-size: 0.8125rem; padding: 0.4375rem 0.75rem;
  border-radius: 0.375rem; cursor: pointer; font-family: inherit;
`;
const Danger = styled(Ghost)`border-color: #fecaca; color: #b91c1c; display: inline-flex; align-items: center; gap: 0.25rem; &:disabled { opacity: 0.4; cursor: not-allowed; }`;
const Msg = styled.p`margin: 0; padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.8125rem;`;
const Err = styled.div`
  display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.5rem 0.75rem; margin: 0.5rem 1rem 0; border-radius: 0.5rem;
  background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.8125rem;
`;

const KINDS = {
  subject: { title: '시험 항목 관리', placeholder: '새 시험 항목 이름 — Enter', pick: '왼쪽에서 시험 항목을 고르세요.' },
  agent: { title: '시뮬레이션 관리', placeholder: '새 시뮬레이션 이름 — Enter', pick: '왼쪽에서 시뮬레이션을 고르세요.' },
};
const RULES = [
  { key: 'auto', label: '자동 — 하나면 그 값, 여럿이면 평균' },
  { key: 'mean', label: '평균 — 값 있는 시뮬레이션의 평균' },
  { key: 'single', label: '단일 — 대표 시뮬레이션 하나 (여럿이면 값 없음)' },
];

const toDraft = (kind, item) => (kind === 'subject'
  ? { name: item.name, detail: item.detail || '', product_families: [...(item.product_families || [])],
      accuracy_rule: item.accuracy_rule || 'auto' }
  : { name: item.name, kind: item.kind || '', model_kind: item.model_kind || '', project_uuid: item.project_uuid || '' });

const toPayload = (kind, d) => (kind === 'subject'
  ? { name: d.name, detail: d.detail, product_families: d.product_families, accuracy_rule: d.accuracy_rule }
  : { name: d.name, kind: d.kind, model_kind: d.model_kind || null, project_uuid: d.project_uuid || null });

const ItemManagerModal = ({ kind, divisionId, items, pairCount, canEdit, denyReason, modelKinds = [], onClose, onChanged }) => {
  const meta = KINDS[kind];
  const [pick, setPick] = useState(null);
  const [draft, setDraft] = useState(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(null);      // 'add' | 'save' | 'del' | null
  const [error, setError] = useState(null);

  const api = kind === 'subject'
    ? { create: maturityApi.createSubject, update: maturityApi.updateSubject, remove: maturityApi.deleteSubject }
    : { create: maturityApi.createAgent, update: maturityApi.updateAgent, remove: maturityApi.deleteAgent };

  const current = useMemo(() => items.find(i => i.id === pick) || null, [items, pick]);
  // 고른 것이 바뀌면 초안을 그것으로. 목록이 새로 와도 같은 것을 보고 있으면 초안은 지킨다.
  useEffect(() => { if (current && (!draft || draft._id !== current.id)) setDraft({ _id: current.id, ...toDraft(kind, current) }); },
    [current]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = current ? toDraft(kind, current) : null;
  const changed = !!(draft && base && Object.keys(base).some(k => JSON.stringify(base[k] ?? '') !== JSON.stringify(draft[k] ?? '')));
  // 제품군 제안 — 이 사업부의 다른 시험이 이미 쓰는 이름. 같은 뜻을 다른 글자로 적지 않게.
  const familyPool = useMemo(() => [...new Set(items.flatMap(i => i.product_families || []))].sort(), [items]);
  const [newFamily, setNewFamily] = useState('');
  const addFamily = () => {
    const f = newFamily.trim();
    if (!f || !d) return;
    if (!d.product_families.includes(f)) set({ product_families: [...d.product_families, f] });
    setNewFamily('');
  };
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));

  const run = async (what, fn) => {
    setBusy(what);
    try { const r = await fn(); setError(null); onChanged(); return r; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(null); }
  };

  const add = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    const r = await run('add', () => api.create({ division_id: divisionId, name }));
    if (r?.data?.id) { setNewName(''); setPick(r.data.id); setDraft(null); }
  };
  const save = async () => {
    if (!changed || !draft.name.trim()) return;
    const r = await run('save', () => api.update(current.id, toPayload(kind, draft)));
    if (r) setDraft(null);
  };
  const remove = async () => {
    const n = pairCount[current.id] || 0;
    if (!window.confirm(`「${current.name}」을 지웁니다. 걸린 쌍 ${n}개와 그 평가·이력이 같이 사라집니다.`)) return;
    const r = await run('del', () => api.remove(current.id));
    if (r) { setPick(null); setDraft(null); }
  };

  const d = draft && current && draft._id === current.id ? draft : null;

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <Head>
          <Title>{meta.title}</Title>
          <Count>{items.length}개</Count>
          {denyReason && <Count>· {denyReason} 읽기만 됩니다.</Count>}
          <CloseButton onClick={onClose} title="닫기"><X size={18} /></CloseButton>
        </Head>
        {error && <Err><AlertTriangle size={14} /> <span>{error}</span></Err>}

        <Two>
          <Left>
            {canEdit && (
              <NewRow>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={meta.placeholder}
                       onKeyDown={e => { if (e.key === 'Enter') add(); }} />
                <button type="button" onClick={add} disabled={!newName.trim() || busy === 'add'} title="추가 — 나머지는 오른쪽에서">
                  {busy === 'add' ? <Loader2 size={13} /> : <Plus size={13} />}
                </button>
              </NewRow>
            )}
            <List>
              {items.length === 0 && <Msg>아직 없습니다.{canEdit ? ' 위에 이름을 적고 Enter.' : ''}</Msg>}
              {items.map(item => {
                const n = pairCount[item.id] || 0;
                return (
                  <Pick key={item.id} type="button" $on={pick === item.id}
                        onClick={() => { setPick(item.id); setDraft(null); }}>
                    <b>{item.name}</b>
                    {kind === 'agent' && item.model_kind && (
                      <em title="모델 종류">{modelKinds.find(m => m.key === item.model_kind)?.label?.slice(0, 2) || item.model_kind}</em>
                    )}
                    {n > 0
                      ? <em title="걸린 쌍"><Link2 size={10} />{n}</em>
                      : <Quiet title="아직 아무 쌍에도 안 걸렸습니다"><AlertTriangle size={10} /></Quiet>}
                  </Pick>
                );
              })}
            </List>
          </Left>

          <Right>
            {!current && <Msg>{meta.pick}</Msg>}
            {current && d && kind === 'subject' && (
              <>
                <Field><span>이름</span>
                  <input value={d.name} disabled={!canEdit} onChange={e => set({ name: e.target.value })} /></Field>
                <Pair>
                  <Field><span>세부</span>
                    <input value={d.detail} disabled={!canEdit} onChange={e => set({ detail: e.target.value })} placeholder="예: 1.2m 6면 26모서리" /></Field>
                  <Field><span>항목 정확도 집계</span>
                    <select value={d.accuracy_rule} disabled={!canEdit} onChange={e => set({ accuracy_rule: e.target.value })}>
                      {RULES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                    <small>시뮬레이션이 여럿일 때 항목 정확도를 어떻게 낼지. 사업부 엑셀의 규칙과 맞춥니다.</small></Field>
                </Pair>
                <Field><span>적용 제품군</span>
                  <Chips>
                    {d.product_families.map(f => (
                      <Chip key={f}>{f}
                        {canEdit && <button type="button" title="빼기" onClick={() => set({ product_families: d.product_families.filter(x => x !== f) })}><X size={11} /></button>}
                      </Chip>
                    ))}
                    {d.product_families.length === 0 && <small>아직 없습니다.</small>}
                    {canEdit && (
                      <ChipAdd>
                        <input list={`fam-${current.id}`} value={newFamily} onChange={e => setNewFamily(e.target.value)}
                               placeholder="제품군 이름 — Enter" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFamily(); } }} />
                        <datalist id={`fam-${current.id}`}>{familyPool.filter(f => !d.product_families.includes(f)).map(f => <option key={f} value={f} />)}</datalist>
                        <button type="button" onClick={addFamily} disabled={!newFamily.trim()} title="추가"><Plus size={11} /></button>
                      </ChipAdd>
                    )}
                  </Chips>
                  <small>하나씩 넣습니다. 이 사업부의 다른 시험이 쓰는 이름이 제안으로 뜹니다 — 적용 범위 축의 비율은 이 목록을 사업부 전체 제품군과 대봐 셉니다.</small>
                </Field>
                <Info>걸린 쌍 <strong>{pairCount[current.id] || 0}</strong>개. 쌍을 잇거나 끊는 것은 목록 탭에서.</Info>
              </>
            )}
            {current && d && kind === 'agent' && (
              <>
                <Field><span>이름</span>
                  <input value={d.name} disabled={!canEdit} onChange={e => set({ name: e.target.value })} />
                  <small>엑셀 행 단위 — 정확도가 그 단위로 나옵니다. 과제 단위로 묶지 마세요.</small></Field>
                <Pair>
                  <Field><span>종류</span>
                    <input value={d.kind} disabled={!canEdit} onChange={e => set({ kind: e.target.value })} placeholder="예: 구조, 열, 유동, 전자기" /></Field>
                  <Field><span>모델 종류</span>
                    <select value={d.model_kind} disabled={!canEdit} onChange={e => set({ model_kind: e.target.value })}>
                      <option value="">— 안 정함 —</option>
                      {modelKinds.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <small>물리 기반 / 데이터 기반 / 하이브리드. 부문이 아니라 속성입니다.</small></Field>
                </Pair>
                <Field><span>대시보드 과제 uuid (참고)</span>
                  <input value={d.project_uuid} disabled={!canEdit} onChange={e => set({ project_uuid: e.target.value })} placeholder="비워도 됩니다" />
                  <small>있으면 쌍 상세에 「과제 열기」가 열립니다.</small></Field>
                <Info>걸린 쌍 <strong>{pairCount[current.id] || 0}</strong>개. 쌍을 잇거나 끊는 것은 목록 탭에서.</Info>
              </>
            )}
          </Right>
        </Two>

        <Foot>
          {canEdit && current && (
            <Danger type="button" onClick={remove} disabled={busy === 'del'}><Trash2 size={13} /> 지우기</Danger>
          )}
          {!canEdit && <Note>읽기만 됩니다 — 자기 사업부의 것만 고칠 수 있습니다.</Note>}
          {canEdit && current && !changed && <Note>고치면 저장할 수 있습니다</Note>}
          <Ghost type="button" onClick={onClose} style={{ marginLeft: 'auto' }}>닫기</Ghost>
          {canEdit && current && (
            <Save type="button" onClick={save} disabled={!changed || !d?.name?.trim() || busy === 'save'}>
              {busy === 'save' ? '담는 중…' : '저장'}
            </Save>
          )}
        </Foot>
      </Panel>
    </Overlay>
  );
};

export default ItemManagerModal;
