import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Plus, Pencil, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import SearchSelect from '../common/SearchSelect';
import PairSide from '../Pair/PairSide';

// 디지털 스레드의 「목록」 — 왼쪽은 스레드 › 구간 표(출발 → 매개 → 도착), 오른쪽은 고른 구간의 축 카드(2026-08-28).
// 구간 = 대상(수단 없는 연계)이라 오른쪽은 시뮬레이션 부문의 연계 상세(PairSide)를 그대로 쓴다.
// 아래 줄에서 구간을 더한다: 스레드 → 표준 구간(또는 이름) → 출발 조직·시스템 / 매개 / 도착 조직·시스템.

const Wrap = styled.div`display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; flex: 1; min-height: 0;`;
const Left = styled.div`display: flex; flex-direction: column; min-height: 0; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white;`;
const Top = styled.div`flex-shrink: 0; display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;`;
const Hint = styled.span`margin-left: auto; font-size: 0.75rem; color: #94a3b8; font-weight: 400;`;
const Scroll = styled.div`flex: 1; min-height: 0; overflow: auto;`;
const Table = styled.table`
  width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.8125rem;
  th { position: sticky; top: 0; z-index: 1; background: #f8fafc; text-align: left; font-size: 0.6875rem; font-weight: 700; color: #64748b; padding: 0.4rem 0.6rem; border-bottom: 1px solid #e2e8f0; }
  td { padding: 0.35rem 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
`;
const GroupTr = styled.tr`
  background: ${p => (p.$band ? '#f8fafc' : 'white')};
  ${p => (p.$first ? '& > td { border-top: 2px solid #cbd5e1; }' : '')}
`;
const ThreadCell = styled.td`font-weight: 700; color: #1e293b; border-right: 1px solid #e2e8f0; white-space: nowrap; vertical-align: top !important; small { display: block; font-weight: 400; color: #94a3b8; font-size: 0.6875rem; }`;
const SegCell = styled.td`
  cursor: pointer; color: #1e293b; position: relative; padding-right: 1.8rem !important; overflow-wrap: anywhere;
  background: ${p => (p.$on ? '#eff6ff' : 'transparent')}; box-shadow: ${p => (p.$on ? 'inset 3px 0 0 #1d4ed8' : 'none')};
  &:hover { background: ${p => (p.$on ? '#dbeafe' : '#f1f5f9')}; }
  small { color: #94a3b8; font-size: 0.6875rem; margin-left: 0.4rem; }
`;
const EditBtn = styled.button`
  position: absolute; top: 0.3rem; right: 0.3rem; border: 1px solid #e2e8f0; background: white; color: #64748b; border-radius: 0.3rem;
  width: 1.4rem; height: 1.4rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0;
  td:hover > & { opacity: 1; } &:hover { border-color: #1d4ed8; color: #1d4ed8; } &:focus { opacity: 1; }
`;
const Flow = styled.td`font-size: 0.75rem; color: #475569; white-space: nowrap; b { color: #1e293b; font-weight: 600; } i { font-style: normal; color: #94a3b8; }`;
const Informal = styled.span`display: inline-block; padding: 0 0.4rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; background: #fef3c7; color: #92400e;`;
const Badge = styled.span`display: inline-block; padding: 0 0.45rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; background: #dbeafe; color: #1e40af;`;
const Muted = styled.td`color: #94a3b8; font-style: italic;`;
const Icon = styled.button`border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0.15rem; border-radius: 0.25rem; &:hover { color: #b91c1c; background: #fef2f2; } &:disabled { opacity: 0.3; cursor: not-allowed; }`;
const Form = styled.form`
  flex-shrink: 0; display: flex; flex-direction: column; gap: 0.4rem; padding: 0.6rem 0.75rem; border-top: 1px solid #e2e8f0; background: #f8fbff;
  input, select { padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; background: white; min-width: 0; }
`;
const Line = styled.div`display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;`;
const Lab = styled.span`font-size: 0.75rem; font-weight: 700; color: #64748b; min-width: 3rem;`;
const Button = styled.button`
  padding: 0.35rem 0.8rem; border: 1px solid ${p => (p.$primary ? '#1d4ed8' : '#cbd5e1')}; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  background: ${p => (p.$primary ? '#1d4ed8' : 'white')}; color: ${p => (p.$primary ? 'white' : '#475569')}; display: inline-flex; gap: 0.3rem; align-items: center; white-space: nowrap;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const Notice = styled.div`display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.5rem 0.75rem; margin: 0.5rem 0.75rem 0; border-radius: 0.5rem; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.8125rem;`;

const empty = () => ({ thread_id: '', segment_def_id: '', name: '', from_org_id: '', from_system_id: '', via_system_id: '', to_org_id: '', to_system_id: '', data_kinds: [], custom_kind: '', note: '' });
const KindTag = styled.span`display: inline-block; margin: 0 0.15rem 0.1rem 0; padding: 0 0.4rem; border-radius: 999px; font-size: 0.6875rem; background: #f1f5f9; color: #475569;`;
const Tog = styled.button`padding: 0.15rem 0.5rem; border-radius: 999px; font-family: inherit; font-size: 0.75rem; cursor: pointer; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};`;

const ThreadListView = ({ divisionId, divisions = [], denyReason, axes = [], pairId, thread, onOpenPair, onClosePair, onChanged, refreshKey, onManage }) => {
  const allMode = divisionId === 'all';
  const [division, setDivision] = useState(allMode ? (divisions[0]?.id ?? null) : divisionId);
  useEffect(() => { setDivision(allMode ? (divisions[0]?.id ?? null) : divisionId); }, [divisionId, allMode, divisions]);
  const [threads, setThreads] = useState([]);
  const [segments, setSegments] = useState([]);
  const [systems, setSystems] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [draft, setDraft] = useState(empty());
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const canEdit = !denyReason && division != null;

  const load = async () => {
    if (division == null) return;
    try {
      const [t, s, sy, o] = await Promise.all([maturityApi.listThreads(), maturityApi.listSegments(division), maturityApi.listSystems(), maturityApi.listOrgs(division)]);
      setThreads(t.data || []); setSegments(s.data || []); setSystems(sy.data || []); setOrgs(o.data || []); setError(null);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [division, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkAxis = axes.find(a => a.key === 'link_mode');
  const groups = useMemo(() => threads.map(t => ({ thread: t, rows: segments.filter(s => s.thread_id === t.id) })).filter(g => g.rows.length || true), [threads, segments]);
  const set = (p) => setDraft(d => ({ ...d, ...p }));
  const threadOf = (id) => threads.find(t => t.id === Number(id));
  const defOptions = threadOf(draft.thread_id)?.segments || [];
  const sysOpts = systems.map(s => ({ id: s.id, name: s.kind === 'informal' ? `${s.name} (비공식)` : s.name }));
  const orgOpts = orgs.map(o => ({ id: o.id, name: o.name }));
  const num = (v) => (v === '' || v == null ? null : Number(v));

  const submit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    try {
      const payload = { thread_id: num(draft.thread_id), segment_def_id: num(draft.segment_def_id), name: draft.name, note: draft.note, data_kinds: draft.data_kinds,
        from_org_id: num(draft.from_org_id), from_system_id: num(draft.from_system_id), via_system_id: num(draft.via_system_id), to_org_id: num(draft.to_org_id), to_system_id: num(draft.to_system_id) };
      if (editId) await maturityApi.updateSegment(editId, payload);
      else await maturityApi.createSegment(division, payload);
      setDraft(empty()); setEditId(null); setError(null);
      await load(); if (onChanged) onChanged();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const startEdit = (s) => {
    setEditId(s.id);
    setDraft({ thread_id: s.thread_id ?? '', segment_def_id: s.segment_def_id ?? '', name: s.name || '', note: s.note || '', data_kinds: [...(s.data_kinds || [])], custom_kind: '',
      from_org_id: s.from_org_id ?? '', from_system_id: s.from_system_id ?? '', via_system_id: s.via_system_id ?? '', to_org_id: s.to_org_id ?? '', to_system_id: s.to_system_id ?? '' });
  };
  const remove = async (s) => {
    if (!window.confirm(`「${s.name}」 구간을 지울까요? 평가·이력이 같이 사라집니다.`)) return;
    setBusy(true);
    try { await maturityApi.deleteSegment(s.id); if (pairId === s.pair_id) onClosePair(); await load(); if (onChanged) onChanged(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const linkOf = (s) => {
    const a = s.pair?.assessments?.link_mode;
    return a && a.rung_index != null ? linkAxis?.rungs?.[a.rung_index]?.label : null;
  };

  let band = 0;
  return (
    <Wrap>
      <Left>
        <Top>
          {allMode && (
            <select value={division ?? ''} onChange={e => setDivision(Number(e.target.value))} aria-label="사업부" style={{ fontFamily: 'inherit', fontSize: '0.8125rem', padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          구간 {segments.length}
          <Hint>시스템 {systems.filter(s => s.kind !== 'informal').length} · 조직 {orgs.length} — 관리는 헤더 단추에서</Hint>
        </Top>
        {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
        <Scroll>
          <Table>
            <thead><tr><th style={{ width: '22%' }}>스레드</th><th>구간</th><th>출발 → 매개 → 도착</th><th style={{ width: '9rem' }}>연결 방식</th><th style={{ width: '2.5rem' }} /></tr></thead>
            <tbody>
              {groups.map((g) => {
                const rows = g.rows;
                const span = Math.max(1, rows.length);
                const gi = band++;
                const cell = (
                  <ThreadCell rowSpan={span}>
                    {g.thread.name}
                    <small>표준 구간 {g.thread.segments.length} · 적음 {rows.length}</small>
                  </ThreadCell>
                );
                if (rows.length === 0) {
                  return <GroupTr key={`t-${g.thread.id}`} $band={gi % 2 === 1} $first>{cell}<Muted colSpan={4}>아직 적은 구간이 없습니다.</Muted></GroupTr>;
                }
                return rows.map((s, i) => (
                  <GroupTr key={s.id} $band={gi % 2 === 1} $first={i === 0}>
                    {i === 0 && cell}
                    <SegCell $on={s.pair_id === pairId} onClick={() => s.pair_id && onOpenPair(s.pair_id)} title="누르면 오른쪽에 이 구간의 축이 나옵니다">
                      {s.name}
                      {s.segment_def && <small>{thread?.stages?.find(x => x.key === s.segment_def.from_stage)?.label} → {thread?.stages?.find(x => x.key === s.segment_def.to_stage)?.label}</small>}
                      {s.pair?.unassessed?.length > 0 && <small>미평가 {s.pair.unassessed.length}개</small>}
                      {(s.data_kind_labels || []).length > 0 && <div>{s.data_kind_labels.map(k => <KindTag key={k}>{k}</KindTag>)}</div>}
                      {canEdit && <EditBtn type="button" title="구간 고치기" aria-label={`${s.name} 편집`} onClick={e => { e.stopPropagation(); startEdit(s); }}><Pencil size={11} /></EditBtn>}
                    </SegCell>
                    <Flow>
                      <b>{s.from_org_name || '—'}</b> <i>{s.from_system_name || ''}</i>
                      {' → '}{s.via_informal ? <Informal>{s.via_system_name}</Informal> : <i>{s.via_system_name || '(매개 없음)'}</i>}{' → '}
                      <b>{s.to_org_name || '—'}</b> <i>{s.to_system_name || ''}</i>
                    </Flow>
                    <td>{linkOf(s) ? <Badge>{linkOf(s)}</Badge> : <span style={{ color: '#94a3b8' }}>미평가</span>}</td>
                    <td><Icon disabled={!canEdit} title="구간 지우기 — 평가·이력이 같이 사라집니다" onClick={() => remove(s)}><Trash2 size={14} /></Icon></td>
                  </GroupTr>
                ));
              })}
            </tbody>
          </Table>
        </Scroll>
        {canEdit && (
          <Form onSubmit={submit} aria-label={editId ? '구간 고치기' : '구간 추가'}>
            <Line>
              <Lab>스레드</Lab>
              <select value={draft.thread_id} onChange={e => set({ thread_id: e.target.value, segment_def_id: '' })} aria-label="스레드" required>
                <option value="">— 고르세요 —</option>
                {threads.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={draft.segment_def_id} onChange={e => { const d = defOptions.find(x => String(x.id) === e.target.value); set({ segment_def_id: e.target.value, data_kinds: d && !draft.data_kinds.length ? [...(d.data_kinds || [])] : draft.data_kinds }); }} aria-label="표준 구간" disabled={!draft.thread_id}>
                <option value="">표준 구간 — 고르면 이름을 씁니다</option>
                {defOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input value={draft.name} onChange={e => set({ name: e.target.value })} placeholder={draft.segment_def_id ? '이름(비우면 표준 이름)' : '구간 이름'} aria-label="구간 이름" style={{ flex: 1 }} />
            </Line>
            <Line>
              <Lab>출발</Lab>
              <span style={{ flex: 1, minWidth: '10rem' }}><SearchSelect options={orgOpts} value={draft.from_org_id} onChange={(id) => set({ from_org_id: id ?? '' })} placeholder="조직 찾기" hint="조직 관리에서 먼저 넣으세요." /></span>
              <span style={{ flex: 1, minWidth: '10rem' }}><SearchSelect options={sysOpts} value={draft.from_system_id} onChange={(id) => set({ from_system_id: id ?? '' })} placeholder="시스템 찾기" hint="시스템 관리에서 먼저 넣으세요." /></span>
              <Lab>매개</Lab>
              <span style={{ flex: 1, minWidth: '10rem' }}><SearchSelect options={sysOpts} value={draft.via_system_id} onChange={(id) => set({ via_system_id: id ?? '' })} placeholder="매개 시스템 (메일·엑셀이면 비공식)" hint="시스템 관리에서 먼저 넣으세요." /></span>
            </Line>
            <Line>
              <Lab>데이터</Lab>
              <span style={{ display: 'inline-flex', gap: '0.2rem', flexWrap: 'wrap' }} role="group" aria-label="데이터 종류">
                {(thread?.data_kinds || []).map(k => (
                  <Tog key={k.key} type="button" $on={draft.data_kinds.includes(k.key)} aria-pressed={draft.data_kinds.includes(k.key)}
                       onClick={() => set({ data_kinds: draft.data_kinds.includes(k.key) ? draft.data_kinds.filter(x => x !== k.key) : [...draft.data_kinds, k.key] })}>{k.label}</Tog>
                ))}
                {draft.data_kinds.filter(k => !(thread?.data_kinds || []).some(x => x.key === k)).map(k => (
                  <Tog key={k} type="button" $on onClick={() => set({ data_kinds: draft.data_kinds.filter(x => x !== k) })} title="누르면 뺍니다">{k} ×</Tog>
                ))}
              </span>
              <input value={draft.custom_kind} onChange={e => set({ custom_kind: e.target.value })} placeholder="없는 종류 — Enter" aria-label="데이터 종류 직접 적기" style={{ width: '10rem' }}
                     onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = draft.custom_kind.trim(); if (v && !draft.data_kinds.includes(v)) set({ data_kinds: [...draft.data_kinds, v], custom_kind: '' }); } }} />
            </Line>
            <Line>
              <Lab>도착</Lab>
              <span style={{ flex: 1, minWidth: '10rem' }}><SearchSelect options={orgOpts} value={draft.to_org_id} onChange={(id) => set({ to_org_id: id ?? '' })} placeholder="조직 찾기" hint="조직 관리에서 먼저 넣으세요." /></span>
              <span style={{ flex: 1, minWidth: '10rem' }}><SearchSelect options={sysOpts} value={draft.to_system_id} onChange={(id) => set({ to_system_id: id ?? '' })} placeholder="시스템 찾기" hint="시스템 관리에서 먼저 넣으세요." /></span>
              <input value={draft.note} onChange={e => set({ note: e.target.value })} placeholder="메모" aria-label="메모" style={{ flex: 1 }} />
              <Button type="submit" $primary disabled={busy || !draft.thread_id || (!draft.segment_def_id && !draft.name.trim())}>{editId ? <><Check size={13} /> 고침</> : <><Plus size={13} /> 구간 추가</>}</Button>
              {editId && <Button type="button" onClick={() => { setEditId(null); setDraft(empty()); }}><X size={13} /> 취소</Button>}
              {onManage && <Button type="button" onClick={() => onManage('system')}>시스템 관리</Button>}
              {onManage && <Button type="button" onClick={() => onManage('org')}>조직 관리</Button>}
            </Line>
          </Form>
        )}
      </Left>
      <PairSide pairId={pairId} axes={axes} onChanged={() => { load(); if (onChanged) onChanged(); }} onClose={onClosePair} />
    </Wrap>
  );
};

export default ThreadListView;
