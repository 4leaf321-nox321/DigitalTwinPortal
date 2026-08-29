import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, Loader2, AlertTriangle, Link2, Layers, Wrench, Sparkles, Check, Search } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import ToolPickerModal from './ToolPickerModal';
import ProjectPickerModal from './ProjectPickerModal';
import SearchSelect from '../common/SearchSelect';
import { nextSelection, dragSelection } from '../../utils/selection';

// 시험 항목 / 시뮬레이션 관리 — 왼쪽 목록, 오른쪽 상세. 인텔의 역량 관리와 같은 꼴.
//
//   왼쪽 위   이름(전체 보기면 사업부도) 적고 Enter → 바로 생기고 골라진다
//   왼쪽     목록 — 누르면 오른쪽에 상세. Ctrl+클릭(하나씩 더) · Shift+클릭(범위) ·
//            드래그(범위)로 여럿을 고르면 오른쪽이 **일괄 수정**이 된다
//   오른쪽   그 항목의 칸들. 고치면 저장이 켜진다
//
// ⚠️ 시험 항목도 시뮬레이션도 **사업부에 매인다.** 상세 맨 위가 사업부이고, 걸린 연계이
//    없을 때만 옮긴다(연계은 같은 사업부끼리만). 「전체」로 열면 모든 사업부 것이 사업부별로
//    묶여 보이고, 손댈 수 있는지는 항목마다 그 사업부로 판단한다.
// ⚠️ 일괄 수정에서 **고유한 칸은 뺀다** — 이름·세부·사업부. 나머지는 「그대로 두기」가 기본.
// ⚠️ 지우면 걸린 연계·평가·이력이 같이 간다 — 확인 문구에 그 수를 넣는다.
// ⚠️ 이름표는 label 이 아니라 div 다(인텔 점검 2026-08-26 — label 은 안의 첫 단추를 대신 누른다).

const Overlay = styled.div`
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1.5rem;
`;
const Panel = styled.div`
  background: white; border-radius: 0.75rem; width: min(88rem, 97vw); height: min(52rem, 94vh);   /* 칸이 많아 넓고 높게(2026-08-29) */
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
  flex: 1; min-height: 0; display: grid; grid-template-columns: 26rem 1fr;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;
const Left = styled.div`border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; min-height: 0;`;
const NewRow = styled.div`
  border-bottom: 1px solid #e2e8f0; padding: 0.5rem; display: flex; gap: 0.25rem; background: #f8fafc;
  input, select { font-size: 0.8125rem; padding: 0.35rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.3125rem; font-family: inherit; min-width: 0; }
  input { flex: 1; }
  > button {
    border: none; background: #1d4ed8; color: #fff; border-radius: 0.3125rem; padding: 0 0.625rem; cursor: pointer;
    display: inline-flex; align-items: center; &:disabled { background: #bfdbfe; cursor: not-allowed; }
  }
`;
const TidyBtn = styled.button`
  display: inline-flex; align-items: center; gap: 0.3rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#e2e8f0')};
  background: ${p => (p.$on ? '#eff6ff' : 'white')}; color: ${p => (p.$on ? '#1d4ed8' : '#64748b')};
  border-radius: 0.375rem; padding: 0.3rem 0.6rem; font-size: 0.75rem; font-weight: 600; font-family: inherit; cursor: pointer;
  em { font-style: normal; color: #b45309; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const TidyTable = styled.table`
  width: 100%; border-collapse: collapse; font-size: 0.8125rem;
  th { text-align: left; font-size: 0.6875rem; color: #64748b; padding: 0.35rem 0.5rem; border-bottom: 1px solid #e2e8f0; }
  td { padding: 0.4rem 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  input { font-size: 0.75rem; padding: 0.25rem 0.4rem; border: 1px dashed #cbd5e1; border-radius: 0.3rem; font-family: inherit; width: 12rem; }
`;
const Small = styled.button`
  display: inline-flex; align-items: center; gap: 0.25rem; border: 1px solid #cbd5e1; background: white; color: #475569;
  border-radius: 0.3rem; padding: 0.2rem 0.5rem; font-size: 0.75rem; font-weight: 600; font-family: inherit; cursor: pointer;
  &:hover:not(:disabled) { border-color: #1d4ed8; color: #1d4ed8; } &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const ListHint = styled.div`padding: 0.3rem 0.75rem; font-size: 0.6875rem; color: #94a3b8; border-bottom: 1px solid #f1f5f9; user-select: none;`;
const List = styled.div`flex: 1; min-height: 0; overflow-y: auto; padding: 0.5rem; user-select: none;`;
const Group = styled.div`font-size: 0.6875rem; font-weight: 700; color: #64748b; padding: 0.45rem 0.4375rem 0.15rem; user-select: none;`;
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
  display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem;
  background: ${p => (p.$warn ? '#fffbeb' : p.$partial ? '#f8fafc' : '#eff6ff')};
  color: ${p => (p.$warn ? '#92400e' : p.$partial ? '#64748b' : '#1e40af')};
  border: 1px ${p => (p.$warn ? 'dashed #f59e0b' : p.$partial ? 'dashed #cbd5e1' : 'solid #bfdbfe')};
  border-radius: 999px; padding: 0.15rem 0.3rem 0.15rem 0.55rem;
  button { border: none; background: transparent; color: #60a5fa; cursor: pointer; padding: 0; display: inline-flex; &:hover { color: #1d4ed8; } }
`;
const FindBtn = styled.button`
  display: inline-flex; align-items: center; gap: 0.25rem; border: 1px solid #cbd5e1; background: white; color: #475569;
  border-radius: 999px; padding: 0.2rem 0.55rem; font-size: 0.75rem; font-weight: 600; font-family: inherit; cursor: pointer;
  width: auto; height: auto; white-space: nowrap;
  &:hover { border-color: #1d4ed8; color: #1d4ed8; }
`;
const ChipAdd = styled.div`
  display: flex; gap: 0.25rem; align-items: center;
  input { font-size: 0.75rem; padding: 0.25rem 0.4rem; border: 1px dashed #cbd5e1; border-radius: 999px; font-family: inherit; width: 11rem; }
  /* 둥근 + 단추(첫 번째)에만. 뒤의 「찾기」 단추까지 눌러 글자가 밖으로 나왔었다(2026-08-28). */
  > button:first-of-type { border: none; background: #1d4ed8; color: #fff; border-radius: 999px; width: 1.4rem; height: 1.4rem; cursor: pointer;
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

// 사업부 — 시험 항목도 시뮬레이션도 사업부에 매인다. 연계은 같은 사업부끼리만 잇기 때문에,
// 걸린 연계이 있으면 옮길 수 없다(먼저 끊는다). 다른 사업부로 보내는 것은 가는 쪽도 손댈 수 있어야 한다.
const DivisionField = ({ d, set, canEdit, divisions, pairs }) => (
  <Field>
    <span>사업부</span>
    <select value={d.division_id ?? ''} disabled={!canEdit || pairs > 0} onChange={e => set({ division_id: Number(e.target.value) })}>
      {divisions.map(x => <option key={x.id} value={x.id}>{x.name}{x.deny_reason ? ' (손댈 수 없음)' : ''}</option>)}
    </select>
    <small>{pairs > 0 ? `걸린 연계이 ${pairs}개 있어 옮길 수 없습니다 — 옮기려면 먼저 연계을 끊으세요.` : '연계이 없을 때만 다른 사업부로 옮길 수 있습니다. 연계은 같은 사업부끼리만 잇습니다.'}</small>
  </Field>
);

// 창의 이름은 **부문이 정한다** — 「시험 항목」·「시뮬레이션」은 시뮬레이션 부문의 말이고,
// 모니터링에서는 「공정」·「수집 수단」이다. 부문이 못 알려 주면 시뮬레이션의 말로 떨어진다.
const metaOf = (kind, sectorDef) => {
  const name = kind === 'subject'
    ? (sectorDef?.subject_label || '시험 항목')
    : (sectorDef?.agent_label || '시뮬레이션');
  return { title: `${name} 관리`, placeholder: `새 ${name} 이름 — Enter`, pick: `왼쪽에서 ${name}을 고르세요.`, unit: name };
};
const KEEP = '__keep__';   // 일괄 수정에서 「그대로 두기」

const toDraft = (kind, item) => (kind === 'subject'
  ? { division_id: item.division_id, name: item.name, detail: item.detail || '', product_families: [...(item.product_families || [])],
      accuracy_rule: item.accuracy_rule || 'auto', line: item.line || '', process: item.process || '' }
  : { division_id: item.division_id, name: item.name, kind: item.kind || '', model_kind: item.model_kind || '', tools: [...(item.tools || [])],
      defect_types: [...(item.defect_types || [])], department_id: item.department_id ?? '',
      project_uuids: [...(item.project_uuids || [])] });

const toPayload = (kind, d) => (kind === 'subject'
  ? { division_id: d.division_id, name: d.name, detail: d.detail, product_families: d.product_families, accuracy_rule: d.accuracy_rule,
      line: d.line, process: d.process }
  : { division_id: d.division_id, name: d.name, kind: d.kind, model_kind: d.model_kind || null, tools: d.tools, defect_types: d.defect_types,
      project_uuids: d.project_uuids, department_id: d.department_id === '' ? null : Number(d.department_id) });

/** 일괄 초안의 빈 상태 — 전부 「그대로 두기」. */
const emptyBulk = (kind) => (kind === 'subject'
  ? { accuracy_rule: KEEP, add_families: [], remove_families: [] }
  : { kind: KEEP, model_kind: KEEP, department_id: KEEP, add_tools: [], remove_tools: [], add_defects: [], remove_defects: [] });

const ItemManagerModal = ({
  kind, divisionId, allMode = false, divisions = [], items, pairCount, canEdit, denyReason,
  modelKinds = [], toolSuggestions = [], toolCatalog = [], familyCatalogs = {}, departments = {}, initialId = null, onClose, onChanged,
  sector = 'simulation', processSteps = [], sectorDef = null, accuracyRules = [],
}) => {
  const meta = metaOf(kind, sectorDef);
  const RULES = accuracyRules.length ? accuracyRules : [{ key: 'auto', label: '자동' }];
  const [selected, setSelected] = useState([]);     // id 목록 (순서 = 고른 순서)
  const [anchor, setAnchor] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(null);         // 하나 골랐을 때의 초안
  const [bulk, setBulk] = useState(null);           // 여럿 골랐을 때의 초안
  const [newName, setNewName] = useState('');
  const [newDiv, setNewDiv] = useState('');         // 전체 보기에서 새 항목의 사업부
  const [newFamily, setNewFamily] = useState('');
  const [newTool, setNewTool] = useState('');
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(null);           // 'add' | 'save' | 'del' | null
  const [error, setError] = useState(null);
  const [tidy, setTidy] = useState(null);
  const [tidyOpen, setTidyOpen] = useState(false);
  const [tidyTo, setTidyTo] = useState({});

  const api = kind === 'subject'
    ? { create: maturityApi.createSubject, update: maturityApi.updateSubject, remove: maturityApi.deleteSubject }
    : { create: maturityApi.createAgent, update: maturityApi.updateAgent, remove: maturityApi.deleteAgent };

  // ── 사업부 — 손댈 수 있는지는 항목의 사업부로 ──
  const divName = (id) => divisions.find(x => x.id === id)?.name || '';
  const canTouch = (id) => (allMode ? !divisions.find(x => x.id === id)?.deny_reason : canEdit);
  const touchable = divisions.filter(x => !x.deny_reason);
  useEffect(() => { if (allMode && !newDiv && touchable.length) setNewDiv(String(touchable[0].id)); }, [allMode, divisions]); // eslint-disable-line react-hooks/exhaustive-deps
  const canAdd = allMode ? touchable.length > 0 : canEdit;
  const addDivisionId = allMode ? Number(newDiv) : divisionId;

  const byId = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);
  // 표에서 연필로 열었으면 **그 항목이 골라진 채** 연다. 목록이 나중에 와도 한 번만 잡는다.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || initialId == null) return;
    if (byId[initialId]) { setSelected([initialId]); setAnchor(initialId); setSeeded(true); }
  }, [initialId, byId, seeded]);
  const picked = useMemo(() => selected.map(id => byId[id]).filter(Boolean), [selected, byId]);
  const current = picked.length === 1 ? picked[0] : null;
  const many = picked.length > 1;
  const canEditCur = !!current && canTouch(current.division_id);
  const canEditBulk = many && picked.every(i => canTouch(i.division_id));
  const bulkDivision = many && picked.every(i => i.division_id === picked[0].division_id) ? picked[0].division_id : null;

  useEffect(() => {
    if (current && (!draft || draft._id !== current.id)) setDraft({ _id: current.id, ...toDraft(kind, current) });
    if (many && !bulk) setBulk(emptyBulk(kind));
    if (!many && bulk) setBulk(null);
  }, [current, many, picked.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── 제안 풀 — 같은 사업부의 다른 항목이 쓰는 이름 + 표준(인텔 도구 / 로드맵 제품군) ──
  const poolDivision = d?.division_id ?? (allMode ? null : divisionId);
  const familyCatalog = useMemo(
    () => (poolDivision != null && familyCatalogs[poolDivision]) || (!allMode && familyCatalogs[divisionId]) || [],
    [familyCatalogs, poolDivision, allMode, divisionId]);
  const familyPool = useMemo(() => [...new Set([
    ...items.filter(i => poolDivision == null || i.division_id === poolDivision).flatMap(i => i.product_families || []),
    ...familyCatalog.map(f => f.name)])].sort((a, b) => a.localeCompare(b, 'ko')), [items, familyCatalog, poolDivision]);
  const toolPool = useMemo(
    () => [...new Set([...items.flatMap(i => i.tools || []), ...toolSuggestions])].sort((a, b) => a.localeCompare(b, 'ko')),
    [items, toolSuggestions]);
  const standardSet = useMemo(() => new Set(toolSuggestions), [toolSuggestions]);

  // ── 고르기 — 규칙은 utils/selection.js (시험 있음). 여럿→여럿은 일괄 초안을 지킨다. ──
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
    if (!name || busy || !addDivisionId) return;
    const r = await run('add', () => api.create({ division_id: addDivisionId, name, sector }));
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
    if (!window.confirm(`${what}을 지웁니다. 걸린 연계 ${n}개와 그 평가·이력이 같이 사라집니다.`)) return;
    const r = await run('del', () => Promise.all(picked.map(i => api.remove(i.id))));
    if (r) { setSelected([]); setDraft(null); setBulk(null); }
  };

  // ── 일괄 수정 ──
  const bulkChanged = !!bulk && (kind === 'subject'
    ? (bulk.accuracy_rule !== KEEP || bulk.add_families.length > 0 || bulk.remove_families.length > 0)
    : (bulk.kind !== KEEP || bulk.model_kind !== KEEP || bulk.department_id !== KEEP || bulk.add_tools.length > 0 || bulk.remove_tools.length > 0
       || bulk.add_defects.length > 0 || bulk.remove_defects.length > 0));
  const bulkPayload = (item) => {
    if (kind === 'subject') {
      const fams = (item.product_families || []).filter(f => !bulk.remove_families.includes(f));
      bulk.add_families.forEach(f => { if (!fams.includes(f)) fams.push(f); });
      const p = { product_families: fams };
      if (bulk.accuracy_rule !== KEEP) p.accuracy_rule = bulk.accuracy_rule;
      return p;
    }
    const tools = (item.tools || []).filter(t => !bulk.remove_tools.includes(t));
    bulk.add_tools.forEach(t => { if (!tools.includes(t)) tools.push(t); });
    const defects = (item.defect_types || []).filter(t => !bulk.remove_defects.includes(t));
    bulk.add_defects.forEach(t => { if (!defects.includes(t)) defects.push(t); });
    const p = { tools, defect_types: defects };
    if (bulk.kind !== KEEP) p.kind = bulk.kind;
    if (bulk.model_kind !== KEEP) p.model_kind = bulk.model_kind || null;
    if (bulk.department_id !== KEEP) p.department_id = bulk.department_id === '' ? null : Number(bulk.department_id);
    return p;
  };
  const saveBulk = async () => {
    if (!bulkChanged) return;
    const r = await run('save', () => Promise.all(picked.map(i => api.update(i.id, bulkPayload(i)))));
    if (r) setBulk(emptyBulk(kind));
  };
  const unionOf = (key) => {
    const c = {};
    picked.forEach(i => (i[key] || []).forEach(v => { c[v] = (c[v] || 0) + 1; }));
    return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const familyUnion = useMemo(() => unionOf('product_families'), [picked]); // eslint-disable-line react-hooks/exhaustive-deps
  const toolUnion = useMemo(() => unionOf('tools'), [picked]); // eslint-disable-line react-hooks/exhaustive-deps
  const defectUnion = useMemo(() => unionOf('defect_types'), [picked]); // eslint-disable-line react-hooks/exhaustive-deps
  // 불량 유형 제안 — 같은 창의 시뮬레이션들이 이미 적은 것. 사전은 따로 두지 않는다(자유 텍스트).
  const defectPool = useMemo(
    () => [...new Set(items.flatMap(i => i.defect_types || []))].sort((a, b) => a.localeCompare(b, 'ko')),
    [items]);
  const [newDefect, setNewDefect] = useState('');
  // 수행 디지털 트윈 과제 — 그 사업부의 대시보드 과제를 처음 쓸 때 한 번 불러 둔다(2026-08-29)
  const [projectsBy, setProjectsBy] = useState({});
  const [projPicker, setProjPicker] = useState(false);   // 「상세」로 여는 과제 고르기 창
  // ⚠️ 시뮬레이션 전용 손잡이(정돈·가져오기·제품군)는 **「시뮬레이션이면」으로** 가른다.
  const isSim = sector === 'simulation';
  const [pickedProjects, setPickedProjects] = useState([]);   // 창에서 고른 것의 이름표(다른 사업부 것은 목록에 없다)
  const curDiv = current && kind === 'agent' ? (draft?.division_id ?? current.division_id) : null;
  useEffect(() => {
    if (curDiv == null || projectsBy[curDiv]) return;
    maturityApi.listProjects(curDiv)
      .then(r => setProjectsBy(m => ({ ...m, [curDiv]: Array.isArray(r.data) ? r.data : [] })))
      .catch(() => setProjectsBy(m => ({ ...m, [curDiv]: [] })));
  }, [curDiv, projectsBy]);
  const addDefect = () => {
    const t = newDefect.trim();
    if (!t) return;
    if (many) { if (!bulk.add_defects.includes(t)) setB({ add_defects: [...bulk.add_defects, t], remove_defects: bulk.remove_defects.filter(x => x !== t) }); }
    else if (d && !d.defect_types.includes(t)) set({ defect_types: [...d.defect_types, t] });
    setNewDefect('');
  };

  const addFamily = () => {
    const f = newFamily.trim();
    if (!f) return;
    if (many) { if (!bulk.add_families.includes(f)) setB({ add_families: [...bulk.add_families, f], remove_families: bulk.remove_families.filter(x => x !== f) }); }
    else if (d && !d.product_families.includes(f)) set({ product_families: [...d.product_families, f] });
    setNewFamily('');
  };
  const addTool = () => {
    const t = newTool.trim();
    if (!t) return;
    if (many) { if (!bulk.add_tools.includes(t)) setB({ add_tools: [...bulk.add_tools, t], remove_tools: bulk.remove_tools.filter(x => x !== t) }); }
    else if (d && !d.tools.includes(t)) set({ tools: [...d.tools, t] });
    setNewTool('');
  };
  const addMany = (names) => {
    const fresh = names.map(n => n.trim()).filter(Boolean);
    if (!fresh.length) return;
    if (kind === 'subject') {
      if (many) setB({ add_families: [...new Set([...bulk.add_families, ...fresh])], remove_families: bulk.remove_families.filter(x => !fresh.includes(x)) });
      else if (d) set({ product_families: [...new Set([...d.product_families, ...fresh])] });
      return;
    }
    if (many) setB({ add_tools: [...new Set([...bulk.add_tools, ...fresh])], remove_tools: bulk.remove_tools.filter(x => !fresh.includes(x)) });
    else if (d) set({ tools: [...new Set([...d.tools, ...fresh])] });
  };

  // ── 정돈 — 도구(인텔 표준)와 제품군(로드맵 표준)이 같은 판. 사업부 하나일 때만. ──
  const TIDY = kind === 'agent'
    ? { label: '도구', title: '도구 이름 정돈', standard: '기술정보 모듈의 도구 이름', rows: 'tools', inKey: 'in_intel',
        audit: maturityApi.getToolAudit, rename: maturityApi.renameTool, pool: 'tool-pool',
        hint: '표준에 없는 이름도 그대로 둘 수 있습니다 — 사내 도구는 인텔에 없는 게 정상입니다. 정돈은 같은 도구를 다른 글자로 세지 않기 위한 것입니다.' }
    : { label: '제품군', title: '제품군 이름 정돈', standard: '로드맵 정보의 제품군 설정', rows: 'families', inKey: 'in_standard',
        audit: maturityApi.getFamilyAudit, rename: maturityApi.renameFamily, pool: 'fam-pool',
        hint: '로드맵 정보에 없는 제품군도 그대로 둘 수 있습니다. 같은 제품군을 두 모듈이 다른 글자로 부르면 어긋남 셈이 틀어지므로, 로드맵 쪽 이름을 표준으로 봅니다.' };
  const loadTidy = async () => {
    try { setTidy((await TIDY.audit(divisionId)).data); setError(null); } catch (e) { setError(e.message); }
  };
  useEffect(() => { if (tidyOpen && !allMode) loadTidy(); }, [kind, tidyOpen, items]); // eslint-disable-line react-hooks/exhaustive-deps
  const renameOne = async (from, to) => {
    const target = (to || '').trim();
    if (!target || target === from) return;
    const r = await run('save', () => TIDY.rename(divisionId, from, target));
    if (r) { setTidyTo(x => ({ ...x, [from]: undefined })); loadTidy(); }
  };
  const tidyRows = tidy ? (tidy[TIDY.rows] || []) : null;
  const showTidy = tidyOpen && !allMode;

  const canSave = many ? (bulkChanged && canEditBulk) : (changed && canEditCur && !!d?.name?.trim());

  // 전체 보기면 사업부별로 묶어 그린다
  const groups = useMemo(() => {
    if (!allMode) return [[null, items]];
    const order = divisions.map(x => x.id);
    const m = new Map();
    items.forEach(i => { if (!m.has(i.division_id)) m.set(i.division_id, []); m.get(i.division_id).push(i); });
    return [...m.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [items, allMode, divisions]);

  const renderItem = (item) => {
    const n = pairCount[item.id] || 0;
    return (
      <Pick key={item.id} type="button" $on={selected.includes(item.id)}
            onClick={e => pickOne(item.id, e)} onMouseDown={e => dragStart(item.id, e)} onMouseEnter={() => dragOver(item.id)}>
        <b>{item.name}</b>
        {kind === 'agent' && item.model_kind && (
          <em title="모델 종류">{modelKinds.find(m => m.key === item.model_kind)?.label?.slice(0, 2) || item.model_kind}</em>
        )}
        {kind === 'agent' && item.department_name && (
          <em title="담당 부서">{item.department_name}</em>
        )}
        {kind === 'agent' && (item.tools || []).length > 0 && (
          <em title={`도구: ${item.tools.join(' · ')}`}><Wrench size={10} />{item.tools.length}</em>
        )}
        {n > 0
          ? <em title="걸린 연계"><Link2 size={10} />{n}</em>
          : <Quiet title="아직 아무 연계에도 안 걸렸습니다"><AlertTriangle size={10} /></Quiet>}
      </Pick>
    );
  };

  // 모니터링의 대상은 **라인 × 공정 단계**다(PLAN-monitoring 2-2) — 제품군·정확도 집계 대신
  // 라인과 공정을 받는다. 설비 개체는 세지 않고, 대수는 평가의 근거 칸으로 간다.
  const isMon = sector === 'manufacturing_monitoring';   // 대상이 라인 × 공정인 부문
  const fieldsSubject = () => (
    <>
      <DivisionField d={d} set={set} canEdit={canEditCur} divisions={divisions} pairs={pairCount[current.id] || 0} />
      <Field><span>이름</span>
        <input value={d.name} disabled={!canEditCur} onChange={e => set({ name: e.target.value })}
               placeholder={isMon ? '예: A라인 · SMT 실장' : ''} /></Field>
      {isMon ? (
        <>
          <Pair>
            <Field><span>라인·사업장</span>
              <input value={d.line} disabled={!canEditCur} onChange={e => set({ line: e.target.value })} placeholder="예: A라인 · 구미 2공장" />
              <small>사업부가 쓰는 이름 그대로. 모판 묶음과 필터의 기준입니다.</small></Field>
            <Field><span>공정 단계</span>
              <SearchSelect options={processSteps.map(p => ({ id: p.key, name: p.label, sub: p.group }))}
                            value={d.process || null} disabled={!canEditCur}
                            onChange={(k) => set({ process: k == null ? '' : String(k) })}
                            placeholder="공정 이름으로 찾기" hint="없으면 세부에 적으세요." />
              <small>표준 어휘에서 고릅니다 — 라인 이름이 갈려도 공정끼리는 사업부를 넘어 비교됩니다.</small></Field>
          </Pair>
          <Field><span>세부</span>
            <input value={d.detail} disabled={!canEditCur} onChange={e => set({ detail: e.target.value })} placeholder="예: 마운터 8대 · 리플로우 2대" />
            <small>설비 대수·기종을 적어 두세요. 설비 개체는 줄로 세우지 않습니다 — 대수는 평가의 근거(「상태 8/12대」)로 갑니다.</small></Field>
        </>
      ) : (
      <Pair>
        <Field><span>세부</span>
          <input value={d.detail} disabled={!canEditCur} onChange={e => set({ detail: e.target.value })} placeholder="예: 1.2m 6면 26모서리" /></Field>
        <Field><span>항목 정확도 집계</span>
          <select value={d.accuracy_rule} disabled={!canEditCur} onChange={e => set({ accuracy_rule: e.target.value })}>
            {RULES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <small>수단이 여럿일 때 항목 정확도를 어떻게 낼지. 사업부 엑셀의 규칙과 맞춥니다.</small></Field>
      </Pair>
      )}
      {!isMon && (
      <Field><span>적용 제품군</span>
        <Chips>
          {d.product_families.map(f => (
            <Chip key={f}>{f}
              {canEditCur && <button type="button" title="빼기" onClick={() => set({ product_families: d.product_families.filter(x => x !== f) })}><X size={11} /></button>}
            </Chip>
          ))}
          {d.product_families.length === 0 && <small>아직 없습니다.</small>}
          {canEditCur && (
            <ChipAdd>
              <input list="fam-pool" value={newFamily} onChange={e => setNewFamily(e.target.value)}
                     placeholder="제품군 이름 — Enter" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFamily(); } }} />
              <button type="button" onClick={addFamily} disabled={!newFamily.trim()} title="추가"><Plus size={11} /></button>
              <FindBtn type="button" onClick={() => setPicker(true)} title="이 사업부·로드맵 정보·다른 사업부의 제품군을 보고 고릅니다"><Search size={11} /> 찾기</FindBtn>
            </ChipAdd>
          )}
        </Chips>
        <small>하나씩 넣습니다. 「찾기」로 이 사업부·로드맵 정보·다른 사업부의 제품군을 보고 고르세요 — 적용 범위 축의 비율은 이 목록을 사업부 전체 제품군과 대봐 셉니다.</small>
      </Field>
      )}
      <Info>걸린 연계 <strong>{pairCount[current.id] || 0}</strong>개. 연계을 잇거나 끊는 것은 목록 탭에서.</Info>
    </>
  );

  const fieldsAgent = () => (
    <>
      <DivisionField d={d} set={set} canEdit={canEditCur} divisions={divisions} pairs={pairCount[current.id] || 0} />
      <Field><span>이름</span>
        <input value={d.name} disabled={!canEditCur} onChange={e => set({ name: e.target.value })} />
        <small>엑셀 행 단위 — 정확도가 그 단위로 나옵니다. 과제 단위로 묶지 마세요.</small></Field>
      <Pair>
        <Field><span>종류</span>
          <input value={d.kind} disabled={!canEditCur} onChange={e => set({ kind: e.target.value })} placeholder="예: 구조, 열, 유동, 전자기" /></Field>
        {isSim && (
        <Field><span>모델 종류</span>
          <select value={d.model_kind} disabled={!canEditCur} onChange={e => set({ model_kind: e.target.value })}>
            <option value="">— 안 정함 —</option>
            {modelKinds.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            {/* 기준 정보에서 빠진 값이 이미 적혀 있으면 그대로 보여 준다 — 숨기면 모르는 채로 덮어쓴다 */}
            {d.model_kind && !modelKinds.some(m => m.key === d.model_kind)
              && <option value={d.model_kind}>{d.model_kind} — 없는 종류</option>}
          </select>
          <small>{modelKinds.map(m => m.label).join(' / ')}. 부문이 아니라 속성입니다.</small></Field>
        )}
      </Pair>
      <Field><span>담당 부서</span>
        <SearchSelect options={departments[d.division_id] || []} value={d.department_id} disabled={!canEditCur}
                      onChange={(id) => set({ department_id: id == null ? '' : id })}
                      placeholder="부서 이름으로 찾기" hint="이 사업부에 그런 부서가 없습니다." />
        <small>이 {meta.unit}을 맡는 부서 — 포탈의 부서 표에서 {divName(d.division_id)} 사업부의 활성 부서만 고릅니다.{(departments[d.division_id] || []).length === 0 ? ' 이 사업부에 등록된 부서가 없습니다 — 부서 표(대시보드 설정)에 먼저 넣으세요.' : ''}</small>
      </Field>
      <Field><span>도구</span>
        <Chips>
          {d.tools.map(t => (
            <Chip key={t} $warn={standardSet.size > 0 && !standardSet.has(t)}
                  title={standardSet.size > 0 && !standardSet.has(t) ? '기술정보 모듈에 없는 표기 — 「도구 정돈」에서 맞출 수 있습니다' : undefined}>{t}
              {canEditCur && <button type="button" title="빼기" onClick={() => set({ tools: d.tools.filter(x => x !== t) })}><X size={11} /></button>}
            </Chip>
          ))}
          {d.tools.length === 0 && <small>아직 없습니다.</small>}
          {canEditCur && (
            <ChipAdd>
              <input list="tool-pool" value={newTool} onChange={e => setNewTool(e.target.value)}
                     placeholder="도구 이름 — Enter" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTool(); } }} />
              <button type="button" onClick={addTool} disabled={!newTool.trim()} title="추가"><Plus size={11} /></button>
              <FindBtn type="button" onClick={() => setPicker(true)} title="기술정보 모듈의 도구 전체를 분야별로 보고 고릅니다"><Search size={11} /> 찾기</FindBtn>
            </ChipAdd>
          )}
        </Chips>
        <small>이 {meta.unit}에 쓰는 도구를 하나씩 — 예: LS-DYNA, HyperMesh. 모르는 이름은 「찾기」로 분야를 훑어 고르세요. 표준에 없는 사내 도구는 직접 적으면 됩니다.</small>
      </Field>
      {isSim && (
      <Field><span>불량 유형</span>
        <Chips>
          {d.defect_types.map(t => (
            <Chip key={t}>{t}
              {canEditCur && <button type="button" title="빼기" onClick={() => set({ defect_types: d.defect_types.filter(x => x !== t) })}><X size={11} /></button>}
            </Chip>
          ))}
          {d.defect_types.length === 0 && <small>아직 없습니다.</small>}
          {canEditCur && (
            <ChipAdd>
              <input list="defect-pool" value={newDefect} onChange={e => setNewDefect(e.target.value)} aria-label="불량 유형 추가"
                     placeholder="불량 유형 — Enter" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDefect(); } }} />
              <button type="button" onClick={addDefect} disabled={!newDefect.trim()} title="추가"><Plus size={11} /></button>
            </ChipAdd>
          )}
        </Chips>
        <small>이 {meta.unit}이 다루는 불량 유형을 하나씩 — 예: 크랙, 변색, 접점 마모. 다른 {meta.unit}이 적은 이름이 제안으로 뜹니다.</small>
      </Field>
      )}
      <Field><span>수행 디지털 트윈 과제</span>
        <Chips>
          {(d.project_uuids || []).map(u => {
            const p = (projectsBy[d.division_id] || []).find(x => x.uuid === u)
              || pickedProjects.find(x => x.uuid === u)
              || (current.projects || []).find(x => x.uuid === u) || { uuid: u };
            return (
              <Chip key={u} title={p.title || '없어진 과제'}>
                {p.code ? `${p.code} ` : ''}{p.title || '(없어진 과제)'}{p.year ? ` · ${p.year}` : ''}
                {canEditCur && <button type="button" title="빼기" onClick={() => set({ project_uuids: d.project_uuids.filter(x => x !== u) })}><X size={11} /></button>}
              </Chip>
            );
          })}
          {(d.project_uuids || []).length === 0 && <small>아직 없습니다.</small>}
        </Chips>
        {canEditCur && (
          <ChipAdd style={{ gap: '0.3rem' }}>
            {/* 드롭다운은 **가까운 후보 둘만** — 목록 전체는 「상세」에서 사업부·프로세스로 좁혀 고른다(2026-08-29) */}
            <span style={{ flex: 1, minWidth: '12rem' }}>
              <SearchSelect
                options={(projectsBy[d.division_id] || [])
                  .filter(p => !(d.project_uuids || []).includes(p.uuid))
                  .slice(0, 2)
                  .map(p => ({ id: p.uuid, name: `${p.code ? `${p.code} · ` : ''}${p.title}${p.year ? ` (${p.year})` : ''}` }))}
                value={null}
                onChange={(uuid) => uuid && set({ project_uuids: [...(d.project_uuids || []), uuid] })}
                placeholder="최근 과제에서 고르기"
                hint={projectsBy[d.division_id] == null ? '불러오는 중…' : '「상세」에서 사업부·프로세스로 찾으세요.'} />
            </span>
            <FindBtn type="button" onClick={() => setProjPicker(true)} title="과제 목록을 사업부·프로세스로 좁혀 고릅니다"><Search size={11} /> 상세</FindBtn>
          </ChipAdd>
        )}
        <small>이 {meta.unit}을 키우는 디지털 트윈 과제 — 여기 드롭다운은 {divName(d.division_id)} 사업부의 최근 과제 둘만 보여 줍니다. 나머지는 「상세」에서 사업부·프로세스로 좁혀 고르세요.</small>
      </Field>
      <Info>걸린 연계 <strong>{pairCount[current.id] || 0}</strong>개. 연계을 잇거나 끊는 것은 목록 탭에서.</Info>
    </>
  );

  const bulkChips = (union, adding, removing, addKey, removeKey, placeholder, findTitle) => (
    <Chips>
      {union.map(([v, n]) => {
        const rm = removing.includes(v);
        return (
          <Chip key={v} $partial={n < picked.length || rm} title={rm ? '저장하면 전체에서 빠집니다' : `${picked.length}개 중 ${n}개`}
                style={rm ? { textDecoration: 'line-through' } : undefined}>
            {v} <small>{n}/{picked.length}</small>
            {canEditBulk && (rm
              ? <button type="button" title="빼기 취소" onClick={() => setB({ [removeKey]: removing.filter(x => x !== v) })}><Plus size={11} /></button>
              : <button type="button" title="전체에서 빼기" onClick={() => setB({ [removeKey]: [...removing, v], [addKey]: adding.filter(x => x !== v) })}><X size={11} /></button>)}
          </Chip>
        );
      })}
      {adding.map(v => (
        <Chip key={`add-${v}`} title="저장하면 전체에 들어갑니다">+ {v}
          {canEditBulk && <button type="button" title="넣기 취소" onClick={() => setB({ [addKey]: adding.filter(x => x !== v) })}><X size={11} /></button>}
        </Chip>
      ))}
      {canEditBulk && (
        <ChipAdd>
          <input list={kind === 'subject' ? 'fam-pool' : 'tool-pool'} value={kind === 'subject' ? newFamily : newTool}
                 onChange={e => (kind === 'subject' ? setNewFamily : setNewTool)(e.target.value)}
                 placeholder={placeholder} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (kind === 'subject' ? addFamily : addTool)(); } }} />
          <button type="button" onClick={kind === 'subject' ? addFamily : addTool} disabled={!(kind === 'subject' ? newFamily : newTool).trim()} title="전체에 넣기"><Plus size={11} /></button>
          <FindBtn type="button" onClick={() => setPicker(true)} title={findTitle}><Search size={11} /> 찾기</FindBtn>
        </ChipAdd>
      )}
    </Chips>
  );

  const editable = many ? canEditBulk : canEditCur;

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <Head>
          <Title>{meta.title}</Title>
          <Count>{allMode ? '전체' : divName(divisionId)} · {items.length}개{picked.length > 1 && ` · ${picked.length}개 고름`}</Count>
          {!allMode && denyReason && <Count>· {denyReason} 읽기만 됩니다.</Count>}
          <CloseButton onClick={onClose} title="닫기"><X size={18} /></CloseButton>
        </Head>
        {error && <Err><AlertTriangle size={14} /> <span>{error}</span></Err>}

        <Two>
          <Left>
            {canAdd && (
              <NewRow>
                {allMode && (
                  <select value={newDiv} onChange={e => setNewDiv(e.target.value)} title="새 항목의 사업부">
                    {touchable.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                )}
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={meta.placeholder}
                       onKeyDown={e => { if (e.key === 'Enter') add(); }} />
                <button type="button" onClick={add} disabled={!newName.trim() || busy === 'add' || !addDivisionId} title="추가 — 나머지는 오른쪽에서">
                  {busy === 'add' ? <Loader2 size={13} /> : <Plus size={13} />}
                </button>
              </NewRow>
            )}
            <ListHint>
              Ctrl+클릭 하나씩 더 · Shift+클릭 범위 · 드래그 범위 → 여럿을 한 번에 고칩니다
              {isSim && (
              <TidyBtn type="button" $on={showTidy} disabled={allMode} onClick={() => setTidyOpen(v => !v)} style={{ marginLeft: '0.5rem' }}
                       title={allMode ? '사업부를 하나 고르면 정돈할 수 있습니다' : `${TIDY.label} 이름을 ${TIDY.standard}과 대봅니다`}>
                <Sparkles size={12} /> {TIDY.label} 정돈{tidy && tidy.off_standard > 0 && <em>{tidy.off_standard}</em>}
              </TidyBtn>
              )}
            </ListHint>
            <List>
              {items.length === 0 && <Msg>아직 없습니다.{canAdd ? ' 위에 이름을 적고 Enter.' : ''}</Msg>}
              {groups.map(([divId, list]) => (
                <React.Fragment key={divId ?? 'one'}>
                  {allMode && <Group>{divName(divId)} <span style={{ fontWeight: 400 }}>{list.length}</span></Group>}
                  {list.map(renderItem)}
                </React.Fragment>
              ))}
            </List>
          </Left>

          <Right>
            {showTidy && (
              <>
                <BulkHead>
                  <Sparkles size={14} /> {TIDY.title} — {divName(divisionId)}
                  <small>— {TIDY.standard}({tidy?.standard_count ?? '…'}개)이 표준입니다. 맞추면 이 사업부의 모든 {meta.unit}에서 바뀝니다.</small>
                  <Small type="button" onClick={() => setTidyOpen(false)} style={{ marginLeft: 'auto' }}><X size={12} /> 닫기</Small>
                </BulkHead>
                {!tidyRows && <Msg>대보는 중…</Msg>}
                {tidyRows && tidyRows.length === 0 && <Msg>아직 적힌 {TIDY.label}이 없습니다.</Msg>}
                {tidyRows && tidyRows.length > 0 && (
                  <TidyTable>
                    <thead><tr><th>적힌 이름</th><th>쓰는 {meta.unit}</th><th>표준 이름</th><th /></tr></thead>
                    <tbody>
                      {tidyRows.map(r => (
                        <tr key={r.name}>
                          <td>{r[TIDY.inKey] ? r.name : <Chip $warn title={`${TIDY.standard}에 없는 표기`}>{r.name}</Chip>}</td>
                          <td>{r.count}</td>
                          <td>
                            {r[TIDY.inKey] ? <small style={{ color: '#15803d' }}>표준과 같음</small> : (
                              <input list={TIDY.pool} value={tidyTo[r.name] ?? r.suggestion ?? ''}
                                     placeholder={r.suggestion ? '' : '표준 이름을 고르거나 적으세요'} disabled={!canEdit}
                                     onChange={e => setTidyTo(x => ({ ...x, [r.name]: e.target.value }))} />
                            )}
                            {!r[TIDY.inKey] && r.known_variant && <small> · 표기만 다름</small>}
                            {!r[TIDY.inKey] && !r.suggestion && !r.known_variant && <small> · 비슷한 것 없음</small>}
                          </td>
                          <td>
                            {!r[TIDY.inKey] && (
                              <Small type="button" disabled={!canEdit || busy === 'save' || !((tidyTo[r.name] ?? r.suggestion) || '').trim()}
                                     onClick={() => renameOne(r.name, tidyTo[r.name] ?? r.suggestion)} title="이 사업부 전체에서 바꿉니다">
                                <Check size={12} /> 맞추기
                              </Small>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TidyTable>
                )}
                <small style={{ color: '#94a3b8' }}>{TIDY.hint}</small>
              </>
            )}
            {!showTidy && picked.length === 0 && <Msg>{meta.pick}</Msg>}
            {!showTidy && current && d && (kind === 'subject' ? fieldsSubject() : fieldsAgent())}
            {!showTidy && many && bulk && (
              <>
                <BulkHead>
                  <Layers size={14} /> {meta.unit} {picked.length}개 일괄 수정
                  <small>— 고유한 칸({kind === 'subject' ? '이름·세부' : '이름'})과 사업부는 여기서 못 고칩니다. 「그대로 두기」인 칸은 안 바뀝니다.</small>
                </BulkHead>
                <Info>
                  {picked.map(i => (allMode ? `${i.name} (${divName(i.division_id)})` : i.name)).slice(0, 8).join(' · ')}{picked.length > 8 ? ` … 외 ${picked.length - 8}` : ''}
                  {!canEditBulk && <><br />손댈 수 없는 사업부의 항목이 섞여 있어 저장할 수 없습니다.</>}
                </Info>
                {kind === 'subject' && isSim && (
                  <>
                    <Field><span>항목 정확도 집계</span>
                      <select value={bulk.accuracy_rule} disabled={!canEditBulk} onChange={e => setB({ accuracy_rule: e.target.value })}>
                        <option value={KEEP}>— 그대로 두기 —</option>
                        {RULES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select></Field>
                    <Field><span>적용 제품군 — 고른 시험들이 가진 것</span>
                      {bulkChips(familyUnion, bulk.add_families, bulk.remove_families, 'add_families', 'remove_families',
                        '전체에 넣을 제품군 — Enter', '이 사업부·로드맵 정보·다른 사업부의 제품군을 보고 고릅니다')}
                      <small>칩의 ×는 고른 시험 전체에서 뺍니다. 점선 칩은 일부만 가진 것 — 넣으면 전체가 갖게 됩니다.</small>
                    </Field>
                  </>
                )}
                {kind === 'agent' && (
                  <>
                    <Pair>
                      <Field><span>종류</span>
                        <select value={bulk.kind === KEEP ? KEEP : '__set__'} disabled={!canEditBulk}
                                onChange={e => setB({ kind: e.target.value === KEEP ? KEEP : '' })}>
                          <option value={KEEP}>— 그대로 두기 —</option>
                          <option value="__set__">같은 값으로 바꾸기…</option>
                        </select>
                        {bulk.kind !== KEEP && (
                          <input value={bulk.kind} disabled={!canEditBulk} onChange={e => setB({ kind: e.target.value })} placeholder="예: 구조, 열, 유동" />
                        )}</Field>
                      <Field><span>모델 종류</span>
                        <select value={bulk.model_kind} disabled={!canEditBulk} onChange={e => setB({ model_kind: e.target.value })}>
                          <option value={KEEP}>— 그대로 두기 —</option>
                          <option value="">— 안 정함 —</option>
                          {modelKinds.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select></Field>
                    </Pair>
                    <Field><span>담당 부서</span>
                      {bulkDivision == null ? (
                        <small>사업부가 다른 시뮬레이션이 섞여 있어 부서를 한 번에 정할 수 없습니다 — 부서는 사업부에 속합니다.</small>
                      ) : (
                        <SearchSelect options={[{ id: KEEP, name: '— 그대로 두기 —' }, ...(departments[bulkDivision] || [])]}
                                      value={bulk.department_id} disabled={!canEditBulk} allowEmpty={false}
                                      onChange={(id) => setB({ department_id: id == null ? '' : id })}
                                      placeholder="부서 이름으로 찾기" />
                      )}</Field>
                    <Field><span>도구 — 고른 시뮬레이션들이 쓰는 것</span>
                      {bulkChips(toolUnion, bulk.add_tools, bulk.remove_tools, 'add_tools', 'remove_tools',
                        '전체에 넣을 도구 — Enter', '기술정보 모듈의 도구 전체를 분야별로 보고 고릅니다')}
                      <small>칩의 ×는 고른 시뮬레이션 전체에서 뺍니다. 점선 칩은 일부만 쓰는 것.</small>
                    </Field>
                    <Field><span>불량 유형 — 고른 시뮬레이션들이 다루는 것</span>
                      <Chips>
                        {defectUnion.map(([v, n]) => {
                          const removing = bulk.remove_defects.includes(v);
                          return (
                            <Chip key={v} $partial={n < picked.length || removing} title={removing ? '저장하면 전체에서 빠집니다' : `${picked.length}개 중 ${n}개`} style={removing ? { textDecoration: 'line-through' } : undefined}>{v} <small>{n}/{picked.length}</small>
                              {canEditBulk && <button type="button" title={removing ? '빼기 취소' : '전체에서 빼기'}
                                onClick={() => setB({ remove_defects: removing ? bulk.remove_defects.filter(x => x !== v) : [...bulk.remove_defects, v], add_defects: bulk.add_defects.filter(x => x !== v) })}><X size={11} /></button>}
                            </Chip>
                          );
                        })}
                        {bulk.add_defects.filter(v => !defectUnion.some(([u]) => u === v)).map(v => (
                          <Chip key={v} title="저장하면 전체에 들어갑니다">{v}
                            {canEditBulk && <button type="button" title="추가 취소" onClick={() => setB({ add_defects: bulk.add_defects.filter(x => x !== v) })}><X size={11} /></button>}
                          </Chip>
                        ))}
                        {canEditBulk && (
                          <ChipAdd>
                            <input list="defect-pool" value={newDefect} onChange={e => setNewDefect(e.target.value)} aria-label="불량 유형 일괄 추가"
                                   placeholder="전체에 넣을 불량 유형 — Enter" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDefect(); } }} />
                            <button type="button" onClick={addDefect} disabled={!newDefect.trim()} title="추가"><Plus size={11} /></button>
                          </ChipAdd>
                        )}
                      </Chips>
                      <small>칩의 ×는 고른 시뮬레이션 전체에서 뺍니다. 점선 칩은 일부만 다루는 것.</small>
                    </Field>
                  </>
                )}
              </>
            )}
            <datalist id="fam-pool">{familyPool.map(f => <option key={f} value={f} />)}</datalist>
            <datalist id="tool-pool">{toolPool.map(t => <option key={t} value={t} />)}</datalist>
            <datalist id="defect-pool">{defectPool.map(t => <option key={t} value={t} />)}</datalist>
          </Right>
        </Two>

        <Foot>
          {picked.length > 0 && editable && (
            <Danger type="button" onClick={removeSelected} disabled={busy === 'del'}>
              <Trash2 size={13} /> {many ? `${picked.length}개 지우기` : '지우기'}
            </Danger>
          )}
          {((picked.length > 0 && !editable) || (picked.length === 0 && !canAdd)) && (
            <Note>읽기만 됩니다 — 자기 사업부의 것만 고칠 수 있습니다.</Note>
          )}
          {picked.length > 0 && editable && !canSave && <Note>{many ? '바꿀 칸을 고르면 저장할 수 있습니다' : '고치면 저장할 수 있습니다'}</Note>}
          <Ghost type="button" onClick={onClose} style={{ marginLeft: 'auto' }}>닫기</Ghost>
          {picked.length > 0 && editable && (
            <Save type="button" onClick={many ? saveBulk : save} disabled={!canSave || busy === 'save'}>
              {busy === 'save' ? '담는 중…' : many ? `${picked.length}개에 저장` : '저장'}
            </Save>
          )}
        </Foot>
      </Panel>
      {picker && (
        <ToolPickerModal
          catalog={kind === 'subject' ? familyCatalog : toolCatalog}
          have={kind === 'subject'
            ? (many ? [...bulk.add_families] : (d?.product_families || []))
            : (many ? [...bulk.add_tools] : (d?.tools || []))}
          title={many ? `${TIDY.label} 찾기 — ${picked.length}개 ${meta.unit} 전체에 넣기` : `${TIDY.label} 찾기 — ${current?.name || ''}`}
          countLabel={kind === 'subject' ? '제품군' : '기술정보 모듈의 도구'}
          onPick={addMany} onClose={() => setPicker(false)} />
      )}
      {projPicker && draft && (
        <ProjectPickerModal
          divisionId={draft.division_id} divisions={divisions} already={draft.project_uuids || []}
          onPick={(ps) => {
            setPickedProjects(m => [...m, ...ps.filter(p => !m.some(x => x.uuid === p.uuid))]);
            setDraft(x => ({ ...x, project_uuids: [...new Set([...(x.project_uuids || []), ...ps.map(p => p.uuid)])] }));
          }}
          onClose={() => setProjPicker(false)} />
      )}
    </Overlay>
  );
};

export default ItemManagerModal;
