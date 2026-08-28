import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Pencil, X, Check, AlertTriangle } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import SearchSelect from '../common/SearchSelect';

// 연계 개발 기록(2026-08-28) — 시스템 연동·도입·정합화·자동화·폐지 건을 한 줄씩 누적한다.
// 계획서의 「PLM 새로 넣겠다 / SPDM 만들겠다 / 허브로 잇겠다」가 여기 들어오고, 끝나면 그 구간의 연결 방식이
// 전 → 후로 몇 칸 올라갔는지를 적는다 — 계획과 상태가 이어진다. 해석 활용 기록과 같은 문법(토글 · 연도 · 셈).

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.75rem; flex: 1; min-height: 0;`;
const Bar = styled.div`display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;`;
const Chip = styled.button`
  padding: 0.3rem 0.7rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#e2e8f0')}; border-radius: 999px; font-family: inherit; font-size: 0.8125rem; cursor: pointer;
  background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
`;
const Select = styled.select`padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; background: white;`;
const Stats = styled.div`display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8125rem; color: #475569; strong { color: #1e293b; font-size: 1rem; }`;
const Form = styled.form`
  display: flex; flex-direction: column; gap: 0.4rem; padding: 0.6rem 0.75rem; border: 1px solid #bfdbfe; background: #f8fbff; border-radius: 0.5rem;
  input, select { padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; min-width: 0; background: white; }
`;
const Line = styled.div`display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;`;
const Lab = styled.span`font-size: 0.75rem; font-weight: 700; color: #64748b; min-width: 4.5rem;`;
const Toggles = styled.div`display: inline-flex; gap: 0.25rem; flex-wrap: wrap;`;
const Tog = styled.button`
  padding: 0.28rem 0.65rem; border-radius: 999px; font-family: inherit; font-size: 0.8125rem; cursor: pointer; white-space: nowrap;
  border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
  &:hover { border-color: #1d4ed8; }
`;
const Button = styled.button`
  padding: 0.35rem 0.8rem; border: 1px solid ${p => (p.$primary ? '#1d4ed8' : '#cbd5e1')}; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  background: ${p => (p.$primary ? '#1d4ed8' : 'white')}; color: ${p => (p.$primary ? 'white' : '#475569')}; display: inline-flex; gap: 0.3rem; align-items: center; white-space: nowrap;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const Scroll = styled.div`flex: 1; min-height: 0; overflow: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white;`;
const Table = styled.table`
  width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.8125rem;
  th { position: sticky; top: 0; background: #f8fafc; text-align: left; font-size: 0.6875rem; font-weight: 700; color: #64748b; padding: 0.4rem 0.6rem; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:hover td { background: #f8fafc; }
`;
const Tag = styled.span`display: inline-block; padding: 0 0.45rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; background: ${p => p.$bg || '#dbeafe'}; color: ${p => p.$fg || '#1e40af'};`;
const Icon = styled.button`border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0.15rem; border-radius: 0.25rem; &:hover { color: #1d4ed8; background: #eff6ff; }`;
const Muted = styled.td`color: #94a3b8; font-style: italic;`;
const Notice = styled.div`display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.5rem 0.75rem; border-radius: 0.5rem; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.8125rem;`;

const STATUS_STYLE = { planned: ['#f1f5f9', '#64748b'], doing: ['#fef3c7', '#92400e'], done: ['#dcfce7', '#166534'] };
const thisMonth = () => new Date().toISOString().slice(0, 7);
const empty = () => ({ month: thisMonth(), action: 'integrate', status: 'done', segment_id: '', thread_id: '', system_id: '', system_name: '', link_from: '', link_to: '', note: '' });

const ThreadCaseLedger = ({ divisionId, divisions = [], denyReason, thread, axes = [], refreshKey }) => {
  const allMode = divisionId === 'all';
  const [division, setDivision] = useState(allMode ? (divisions[0]?.id ?? null) : divisionId);
  useEffect(() => { setDivision(allMode ? (divisions[0]?.id ?? null) : divisionId); }, [divisionId, allMode, divisions]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([new Date().getFullYear()]);
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [segments, setSegments] = useState([]);
  const [systems, setSystems] = useState([]);
  const [threads, setThreads] = useState([]);
  const [draft, setDraft] = useState(empty());
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const canEdit = !denyReason && division != null;
  const linkAxis = axes.find(a => a.key === 'link_mode');
  const actions = thread?.case_actions || [];
  const statuses = thread?.case_status || [];

  const load = async () => {
    if (division == null) return;
    try {
      const [r, s, y, sg, sy, th] = await Promise.all([
        maturityApi.listThreadCases(division, year, status), maturityApi.threadCaseStats(division, year), maturityApi.threadCaseYears(division),
        maturityApi.listSegments(division), maturityApi.listSystems(), maturityApi.listThreads(),
      ]);
      setRows(r.data || []); setStats(s.data); setYears(y.data || [year]); setSegments(sg.data || []); setSystems(sy.data || []); setThreads(th.data || []); setError(null);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [division, year, status, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (p) => setDraft(d => ({ ...d, ...p }));
  const segOpts = useMemo(() => segments.map(s => ({ id: s.id, name: `${s.thread_name ? `${s.thread_name} · ` : ''}${s.name}` })), [segments]);
  const sysOpts = useMemo(() => systems.filter(s => s.kind !== 'informal').map(s => ({ id: s.id, name: s.name })), [systems]);
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const label = (key) => actions.find(a => a.key === key)?.label || key;
  const statusLabel = (key) => statuses.find(a => a.key === key)?.label || key;

  const submit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    try {
      const payload = { month: draft.month, action: draft.action, status: draft.status, segment_id: num(draft.segment_id), thread_id: num(draft.thread_id),
        system_id: num(draft.system_id), system_name: draft.system_name, link_from: draft.link_from || null, link_to: draft.link_to || null, note: draft.note };
      if (editId) await maturityApi.updateThreadCase(editId, payload);
      else await maturityApi.createThreadCase(division, payload);
      setDraft(empty()); setEditId(null); setError(null);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const startEdit = (r) => {
    setEditId(r.id);
    setDraft({ month: r.month.slice(0, 7), action: r.action, status: r.status, segment_id: r.segment_id ?? '', thread_id: r.thread_id ?? '', system_id: r.system_id ?? '',
      system_name: r.system_id ? '' : (r.system_name || ''), link_from: r.link_from || '', link_to: r.link_to || '', note: r.note || '' });
  };
  const remove = async (r) => {
    if (!window.confirm(`${r.month.slice(0, 7)} ${label(r.action)} · ${r.system_name || r.segment_name || ''} 건을 지울까요?`)) return;
    setBusy(true);
    try { await maturityApi.deleteThreadCase(r.id); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Wrap>
      <Bar>
        {allMode && (
          <Select value={division ?? ''} onChange={e => setDivision(Number(e.target.value))} aria-label="사업부">
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        )}
        <Select value={year} onChange={e => setYear(Number(e.target.value))} aria-label="연도">
          {[...new Set([...years, new Date().getFullYear()])].sort((a, b) => b - a).map(y => <option key={y} value={y}>{y}년</option>)}
        </Select>
        <Chip $on={status === ''} onClick={() => setStatus('')}>전부</Chip>
        {statuses.map(x => <Chip key={x.key} $on={status === x.key} onClick={() => setStatus(x.key)}>{x.label}</Chip>)}
      </Bar>

      {stats && (
        <Stats>
          <span><strong>{stats.count}건</strong> / {year}년</span>
          <span>{statuses.map(x => `${x.label} ${stats.by_status?.[x.key] || 0}`).join(' · ')}</span>
          <span>{actions.filter(a => stats.by_action?.[a.key]).map(a => `${a.label} ${stats.by_action[a.key]}`).join(' · ') || '—'}</span>
          <span title="완료 건에서 연결 방식이 올라간 칸의 합">올라간 칸 <strong>{stats.lift}</strong></span>
          {stats.systems?.length > 0 && <span style={{ color: '#64748b' }}>시스템: {stats.systems.map(s => `${s.name} ${s.count}`).join(' · ')}</span>}
        </Stats>
      )}
      {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}

      {canEdit && (
        <Form onSubmit={submit} aria-label={editId ? '연계 개발 건 고치기' : '연계 개발 건 추가'}>
          <Line>
            <input type="month" value={draft.month} max={thisMonth()} onChange={e => set({ month: e.target.value })} aria-label="연-월" required style={{ width: '8rem' }} />
            <Lab>무엇을</Lab>
            <Toggles role="group" aria-label="무엇을">{actions.map(a => <Tog key={a.key} type="button" $on={draft.action === a.key} aria-pressed={draft.action === a.key} onClick={() => set({ action: a.key })}>{a.label}</Tog>)}</Toggles>
            <Lab>상태</Lab>
            <Toggles role="group" aria-label="상태">{statuses.map(a => <Tog key={a.key} type="button" $on={draft.status === a.key} aria-pressed={draft.status === a.key} onClick={() => set({ status: a.key })}>{a.label}</Tog>)}</Toggles>
          </Line>
          <Line>
            <Lab>구간</Lab>
            <span style={{ flex: 1.4, minWidth: '14rem' }}><SearchSelect options={segOpts} value={draft.segment_id} onChange={(id) => set({ segment_id: id ?? '' })} placeholder="구간 찾기 (없으면 스레드만)" hint="목록 탭에서 구간을 먼저 적으세요." /></span>
            {draft.segment_id === '' && (
              <select value={draft.thread_id} onChange={e => set({ thread_id: e.target.value })} aria-label="스레드">
                <option value="">스레드 —</option>
                {threads.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <Lab>시스템</Lab>
            <span style={{ flex: 1, minWidth: '11rem' }}><SearchSelect options={sysOpts} value={draft.system_id} onChange={(id) => set({ system_id: id ?? '', system_name: id == null ? draft.system_name : '' })} placeholder="시스템 찾기" hint="사전에 없으면 오른쪽에 이름만." /></span>
            {draft.system_id === '' && <input value={draft.system_name} onChange={e => set({ system_name: e.target.value })} placeholder="새 시스템 이름(사전에 없을 때)" aria-label="시스템 이름" style={{ flex: 1 }} />}
          </Line>
          <Line>
            <Lab>연결 방식</Lab>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>전</span>
            <Toggles role="group" aria-label="연결 방식 전">{(linkAxis?.rungs || []).map(r => <Tog key={r.key} type="button" $on={draft.link_from === r.key} onClick={() => set({ link_from: draft.link_from === r.key ? '' : r.key })}>{r.label}</Tog>)}</Toggles>
          </Line>
          <Line>
            <Lab />
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>후</span>
            <Toggles role="group" aria-label="연결 방식 후">{(linkAxis?.rungs || []).map(r => <Tog key={r.key} type="button" $on={draft.link_to === r.key} onClick={() => set({ link_to: draft.link_to === r.key ? '' : r.key })}>{r.label}</Tog>)}</Toggles>
          </Line>
          <Line>
            <Lab>메모</Lab>
            <input value={draft.note} onChange={e => set({ note: e.target.value })} placeholder="무엇을 어떻게 — 한 줄" aria-label="메모" style={{ flex: 1 }} />
            <Button type="submit" $primary disabled={busy || !draft.month || (draft.segment_id === '' && draft.system_id === '' && !draft.system_name.trim())}>{editId ? <><Check size={13} /> 고침</> : <><Plus size={13} /> 추가</>}</Button>
            {editId && <Button type="button" onClick={() => { setEditId(null); setDraft(empty()); }}><X size={13} /> 취소</Button>}
          </Line>
        </Form>
      )}

      <Scroll>
        <Table>
          <thead><tr><th>연-월</th><th>무엇을</th><th>상태</th><th>스레드 · 구간</th><th>시스템</th><th>연결 방식 전 → 후</th><th>메모</th><th>누가</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><Muted colSpan={9}>{year}년에 적힌 건이 없습니다. 위 줄에 한 건씩 적으세요.</Muted></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.month.slice(0, 7)}</td>
                <td><Tag>{label(r.action)}</Tag></td>
                <td><Tag $bg={STATUS_STYLE[r.status]?.[0]} $fg={STATUS_STYLE[r.status]?.[1]}>{statusLabel(r.status)}</Tag></td>
                <td>{r.thread_name}{r.segment_name && <div style={{ color: '#64748b' }}>{r.segment_name}</div>}</td>
                <td>{r.system_name}</td>
                <td>{r.link_from_label || '—'} → {r.link_to_label || '—'}{r.lift != null && r.lift !== 0 && <Tag $bg={r.lift > 0 ? '#dcfce7' : '#fee2e2'} $fg={r.lift > 0 ? '#166534' : '#991b1b'} style={{ marginLeft: '0.3rem' }}>{r.lift > 0 ? `+${r.lift}` : r.lift}</Tag>}</td>
                <td style={{ color: '#64748b' }}>{r.note}</td>
                <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{r.actor_name}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{canEdit && <><Icon onClick={() => startEdit(r)} title="고치기" aria-label="고치기"><Pencil size={13} /></Icon><Icon onClick={() => remove(r)} title="지우기" aria-label="지우기"><Trash2 size={13} /></Icon></>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Scroll>
    </Wrap>
  );
};

export default ThreadCaseLedger;
