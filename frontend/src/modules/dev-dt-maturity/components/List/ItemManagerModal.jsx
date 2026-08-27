import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, Loader2, AlertTriangle, Link2, Layers } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import { nextSelection, dragSelection } from '../../utils/selection';

// 시험 항목 / 시뮬레이션 관리 — 왼쪽 목록, 오른쪽 상세. 인텔의 역량 관리와 같은 꼴.
//
//   왼쪽 위   이름만 적고 Enter → 바로 생기고 골라진다 (나머지는 오른쪽에서)
//   왼쪽     목록 — 누르면 오른쪽에 상세. Ctrl+클릭(하나씩 더) · Shift+클릭(범위) ·
//            드래그(범위)로 여럿을 고르면 오른쪽이 **일괄 수정**이 된다
//   오른쪽   그 항목의 칸들. 고치면 저장이 켜진다
//
// ⚠️ 일괄 수정에서 **고유한 칸은 뺀다** — 이름·세부. 여럿에 같은 이름을
//    쓰면 그건 실수지 편집이 아니다. 나머지는 「그대로 두기」가 기본이고 고른 것만 바뀐다.
//    제품군은 「전체에 넣기」와 칩의 「전체에서 빼기」로 한 번에 다룬다.
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
const ListHint = styled.div`padding: 0.3rem 0.75rem; font-size: 0.6875rem; color: #94a3b8; border-bottom: 1px solid #f1f5f9; user-select: none;`;
const List = styled.div`flex: 1; min-height: 0; overflow-y: auto; padding: 0.5rem; user-select: none;`;
const Pick = styled.button`
  width: 100%; text-align: left; border: 1px solid ${p => (p.$on ? '#93c5fd' : 'transparent')};
  background: ${p => (p.$on ? '#eff6ff' : 'transparent')}; border-radius: 0.375rem; padding: 0.3125rem 0.4375rem;
  cursor: pointer; display: flex; align-items: center; gap: 0.375rem; font: inherit;
  &:hover { background: ${p => (p.$on ? '#dbeafe' : '#f1f5f9')}; }
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
  display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; background: ${p => (p.$partial ? '#f8fafc' : '#eff6ff')};
  color: ${p => (p.$partial ? '#64748b' : '#1e40af')}; border: 1px ${p => (p.$partial ? 'dashed #cbd5e1' : 'solid #bfdbfe')};
  border-radius: 999px; padding: 0.15rem 0.3rem 0.15rem 0.55rem;
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
const BulkHead = styled.div`
  display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: #eff6ff; border: 1px solid #bfdbfe;
  border-radius: 0.5rem; color: #1e40af; font-size: 0.8125rem; font-weight: 700;
  small { font-weight: 400; color: #3b82f6; }
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
  subject: { title: '시험 항목 관리', placeholder: '새 시험 항목 이름 — Enter', pick: '왼쪽에서 시험 항목을 고르세요.', unit: '시험' },
  agent: { title: '시뮬레이션 관리', placeholder: '새 시뮬레이션 이름 — Enter', pick: '왼쪽에서 시뮬레이션을 고르세요.', unit: '시뮬레이션' },
};
const RULES = [
  { key: 'auto', label: '자동 — 하나면 그 값, 여럿이면 평균' },
  { key: 'mean', label: '평균 — 값 있는 시뮬레이션의 평균' },
  { key: 'single', label: '단일 — 대표 시뮬레이션 하나 (여럿이면 값 없음)' },
];
const KEEP = '__keep__';   // 일괄 수정에서 「그대로 두기」

const toDraft = (kind, item) => (kind === 'subject'
  ? { name: item.name, detail: item.detail || '', product_families: [...(item.product_families || [])],
      accuracy_rule: item.accuracy_rule || 'auto' }
  : { name: item.name, kind: item.kind || '', model_kind: item.model_kind || '' });

const toPayload = (kind, d) => (kind === 'subject'
  ? { name: d.name, detail: d.detail, product_families: d.product_families, accuracy_rule: d.accuracy_rule }
  : { name: d.name, kind: d.kind, model_kind: d.model_kind || null });

/** 일괄 초안의 빈 상태 — 전부 「그대로 두기」. */
const emptyBulk = (kind) => (kind === 'subject'
  ? { accuracy_rule: KEEP, add_families: [], remove_families: [] }
  : { kind: KEEP, model_kind: KEEP });

const ItemManagerModal = ({ kind, divisionId, items, pairCount, canEdit, denyReason, modelKinds = [], onClose, onChanged }) => {
  const meta = KINDS[kind];
  const [selected, setSelected] = useState([]);     // id 목록 (순서 = 고른 순서)
  const [anchor, setAnchor] = useState(null);       // Shift·드래그 범위의 시작
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(null);         // 하나 골랐을 때의 초안
  const [bulk, setBulk] = useState(null);           // 여럿 골랐을 때의 초안
  const [newName, setNewName] = useState('');
  const [newFamily, setNewFamily] = useState('');
  const [busy, setBusy] = useState(null);           // 'add' | 'save' | 'del' | null
  const [error, setError] = useState(null);

  const api = kind === 'subject'
    ? { create: maturityApi.createSubject, update: maturityApi.updateSubject, remove: maturityApi.deleteSubject }
    : { create: maturityApi.createAgent, update: maturityApi.updateAgent, remove: maturityApi.deleteAgent };

  const byId = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);
  const picked = useMemo(() => selected.map(id => byId[id]).filter(Boolean), [selected, byId]);
  const current = picked.length === 1 ? picked[0] : null;
  const many = picked.length > 1;

  // 하나 골랐을 때: 그것의 초안. 목록이 새로 와도 같은 것을 보고 있으면 초안은 지킨다.
  useEffect(() => {
    if (current && (!draft || draft._id !== current.id)) setDraft({ _id: current.id, ...toDraft(kind, current) });
    if (many && !bulk) setBulk(emptyBulk(kind));
    if (!many && bulk) setBulk(null);
  }, [current, many, picked.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 드래그는 창 어디서 놓아도 끝난다.
  useEffect(() => {
    if (!dragging) return undefined;
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [dragging]);

  const base = current ? toDraft(kind, current) : null;
  const d = draft && current && draft._id === current.id ? draft : null;
  const changed = !!(d && base && Object.keys(base).some(k => JSON.stringify(base[k] ?? '') !== JSON.stringify(d[k] ?? '')));
  const set = (patch) => setDraft(x => ({ ...x, ...patch }));
  const setB = (patch) => setBulk(x => ({ ...x, ...patch }));

  // 제품군 제안 — 이 사업부의 다른 시험이 이미 쓰는 이름. 같은 뜻을 다른 글자로 적지 않게.
  const familyPool = useMemo(() => [...new Set(items.flatMap(i => i.product_families || []))].sort(), [items]);

  // ── 고르기 — 규칙은 utils/selection.js (시험 있음) ──
  // ⚠️ 여기서 bulk 를 비우면 안 된다(2026-08-28 실제로 깨짐). Ctrl 로 2개→3개가 되면
  //    many 가 그대로 true 라 초안을 다시 만드는 효과가 안 돌고, 비운 초안만 남아
  //    오른쪽이 빈 채였다. 여럿→여럿은 초안을 지킨다 — 적어 둔 것도 안 잃는다.
  const pickOne = (id, e) => {
    setDraft(null);
    const next = nextSelection(items, { selected, anchor }, id, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
    setSelected(next.selected); setAnchor(next.anchor);
  };
  const dragStart = (id, e) => {
    if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;
    setDragging(true); setAnchor(id);
  };
  const dragOver = (id) => {
    if (!dragging) return;
    const next = dragSelection(items, anchor, id);
    if (next) { setDraft(null); setSelected(next); }
  };

  // ── 서버 ──
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
    if (r?.data?.id) { setNewName(''); setSelected([r.data.id]); setAnchor(r.data.id); setDraft(null); }
  };
  const save = async () => {
    if (!changed || !d.name.trim()) return;
    const r = await run('save', () => api.update(current.id, toPayload(kind, d)));
    if (r) setDraft(null);
  };
  const removeSelected = async () => {
    const n = picked.reduce((s, i) => s + (pairCount[i.id] || 0), 0);
    const what = picked.length === 1 ? `「${picked[0].name}」` : `${meta.unit} ${picked.length}개`;
    if (!window.confirm(`${what}을 지웁니다. 걸린 쌍 ${n}개와 그 평가·이력이 같이 사라집니다.`)) return;
    const r = await run('del', () => Promise.all(picked.map(i => api.remove(i.id))));
    if (r) { setSelected([]); setDraft(null); setBulk(null); }
  };

  // ── 일괄 수정 ──
  const bulkChanged = !!bulk && (kind === 'subject'
    ? (bulk.accuracy_rule !== KEEP || bulk.add_families.length > 0 || bulk.remove_families.length > 0)
    : (bulk.kind !== KEEP || bulk.model_kind !== KEEP));
  const bulkPayload = (item) => {
    if (kind === 'subject') {
      const fams = (item.product_families || []).filter(f => !bulk.remove_families.includes(f));
      bulk.add_families.forEach(f => { if (!fams.includes(f)) fams.push(f); });
      const p = { product_families: fams };
      if (bulk.accuracy_rule !== KEEP) p.accuracy_rule = bulk.accuracy_rule;
      return p;
    }
    const p = {};
    if (bulk.kind !== KEEP) p.kind = bulk.kind;
    if (bulk.model_kind !== KEEP) p.model_kind = bulk.model_kind || null;
    return p;
  };
  const saveBulk = async () => {
    if (!bulkChanged) return;
    const r = await run('save', () => Promise.all(picked.map(i => api.update(i.id, bulkPayload(i)))));
    if (r) setBulk(emptyBulk(kind));
  };
  // 고른 시험들의 제품군 합집합 — 몇 개가 갖고 있는지 함께.
  const familyUnion = useMemo(() => {
    const c = {};
    picked.forEach(i => (i.product_families || []).forEach(f => { c[f] = (c[f] || 0) + 1; }));
    return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [picked]);

  const addFamily = () => {
    const f = newFamily.trim();
    if (!f) return;
    if (many) { if (!bulk.add_families.includes(f)) setB({ add_families: [...bulk.add_families, f], remove_families: bulk.remove_families.filter(x => x !== f) }); }
    else if (d && !d.product_families.includes(f)) set({ product_families: [...d.product_families, f] });
    setNewFamily('');
  };

  const canSave = many ? bulkChanged : (changed && !!d?.name?.trim());

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <Head>
          <Title>{meta.title}</Title>
          <Count>{items.length}개{picked.length > 1 && ` · ${picked.length}개 고름`}</Count>
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
            <ListHint>Ctrl+클릭 하나씩 더 · Shift+클릭 범위 · 드래그 범위 → 여럿을 한 번에 고칩니다</ListHint>
            <List>
              {items.length === 0 && <Msg>아직 없습니다.{canEdit ? ' 위에 이름을 적고 Enter.' : ''}</Msg>}
              {items.map(item => {
                const n = pairCount[item.id] || 0;
                return (
                  <Pick key={item.id} type="button" $on={selected.includes(item.id)}
                        onClick={e => pickOne(item.id, e)}
                        onMouseDown={e => dragStart(item.id, e)}
                        onMouseEnter={() => dragOver(item.id)}>
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
            {picked.length === 0 && <Msg>{meta.pick}</Msg>}

            {/* ── 하나 ── */}
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
                        <input list="fam-pool" value={newFamily} onChange={e => setNewFamily(e.target.value)}
                               placeholder="제품군 이름 — Enter" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFamily(); } }} />
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
                <Info>걸린 쌍 <strong>{pairCount[current.id] || 0}</strong>개. 쌍을 잇거나 끊는 것은 목록 탭에서.</Info>
              </>
            )}

            {/* ── 여럿 — 일괄 수정 ── */}
            {many && bulk && (
              <>
                <BulkHead>
                  <Layers size={14} /> {meta.unit} {picked.length}개 일괄 수정
                  <small>— 고유한 칸({kind === 'subject' ? '이름·세부' : '이름'})은 여기서 못 고칩니다. 「그대로 두기」인 칸은 안 바뀝니다.</small>
                </BulkHead>
                <Info>{picked.map(i => i.name).slice(0, 8).join(' · ')}{picked.length > 8 ? ` … 외 ${picked.length - 8}` : ''}</Info>

                {kind === 'subject' && (
                  <>
                    <Field><span>항목 정확도 집계</span>
                      <select value={bulk.accuracy_rule} disabled={!canEdit} onChange={e => setB({ accuracy_rule: e.target.value })}>
                        <option value={KEEP}>— 그대로 두기 —</option>
                        {RULES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select></Field>
                    <Field><span>적용 제품군 — 고른 시험들이 가진 것</span>
                      <Chips>
                        {familyUnion.map(([f, n]) => {
                          const removing = bulk.remove_families.includes(f);
                          return (
                            <Chip key={f} $partial={n < picked.length || removing} title={removing ? '저장하면 전체에서 빠집니다' : `${picked.length}개 중 ${n}개가 가짐`}
                                  style={removing ? { textDecoration: 'line-through' } : undefined}>
                              {f} <small>{n}/{picked.length}</small>
                              {canEdit && (removing
                                ? <button type="button" title="빼기 취소" onClick={() => setB({ remove_families: bulk.remove_families.filter(x => x !== f) })}><Plus size={11} /></button>
                                : <button type="button" title="전체에서 빼기" onClick={() => setB({ remove_families: [...bulk.remove_families, f], add_families: bulk.add_families.filter(x => x !== f) })}><X size={11} /></button>)}
                            </Chip>
                          );
                        })}
                        {bulk.add_families.map(f => (
                          <Chip key={`add-${f}`} title="저장하면 전체에 들어갑니다">+ {f}
                            {canEdit && <button type="button" title="넣기 취소" onClick={() => setB({ add_families: bulk.add_families.filter(x => x !== f) })}><X size={11} /></button>}
                          </Chip>
                        ))}
                        {canEdit && (
                          <ChipAdd>
                            <input list="fam-pool" value={newFamily} onChange={e => setNewFamily(e.target.value)}
                                   placeholder="전체에 넣을 제품군 — Enter" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFamily(); } }} />
                            <button type="button" onClick={addFamily} disabled={!newFamily.trim()} title="전체에 넣기"><Plus size={11} /></button>
                          </ChipAdd>
                        )}
                      </Chips>
                      <small>칩의 ×는 고른 시험 전체에서 뺍니다. 점선 칩은 일부만 가진 것 — 넣으면 전체가 갖게 됩니다.</small>
                    </Field>
                  </>
                )}
                {kind === 'agent' && (
                  <Pair>
                    <Field><span>종류</span>
                      <select value={bulk.kind === KEEP ? KEEP : '__set__'} disabled={!canEdit}
                              onChange={e => setB({ kind: e.target.value === KEEP ? KEEP : '' })}>
                        <option value={KEEP}>— 그대로 두기 —</option>
                        <option value="__set__">같은 값으로 바꾸기…</option>
                      </select>
                      {bulk.kind !== KEEP && (
                        <input value={bulk.kind} disabled={!canEdit} onChange={e => setB({ kind: e.target.value })} placeholder="예: 구조, 열, 유동" />
                      )}</Field>
                    <Field><span>모델 종류</span>
                      <select value={bulk.model_kind} disabled={!canEdit} onChange={e => setB({ model_kind: e.target.value })}>
                        <option value={KEEP}>— 그대로 두기 —</option>
                        <option value="">— 안 정함 —</option>
                        {modelKinds.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                      </select></Field>
                  </Pair>
                )}
              </>
            )}
            <datalist id="fam-pool">{familyPool.map(f => <option key={f} value={f} />)}</datalist>
          </Right>
        </Two>

        <Foot>
          {canEdit && picked.length > 0 && (
            <Danger type="button" onClick={removeSelected} disabled={busy === 'del'}>
              <Trash2 size={13} /> {many ? `${picked.length}개 지우기` : '지우기'}
            </Danger>
          )}
          {!canEdit && <Note>읽기만 됩니다 — 자기 사업부의 것만 고칠 수 있습니다.</Note>}
          {canEdit && picked.length > 0 && !canSave && <Note>{many ? '바꿀 칸을 고르면 저장할 수 있습니다' : '고치면 저장할 수 있습니다'}</Note>}
          <Ghost type="button" onClick={onClose} style={{ marginLeft: 'auto' }}>닫기</Ghost>
          {canEdit && picked.length > 0 && (
            <Save type="button" onClick={many ? saveBulk : save} disabled={!canSave || busy === 'save'}>
              {busy === 'save' ? '담는 중…' : many ? `${picked.length}개에 저장` : '저장'}
            </Save>
          )}
        </Foot>
      </Panel>
    </Overlay>
  );
};

export default ItemManagerModal;
