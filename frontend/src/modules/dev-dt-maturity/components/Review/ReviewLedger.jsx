import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Pencil, X, Check, AlertTriangle, Upload, Download, ArrowUpRight } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import SearchSelect from '../common/SearchSelect';

// 해석 활용 기록 — 시험과 짝이 없는 스팟성 시뮬레이션(설계 스펙 검토·원인 분석)을 **건(件)**으로 쌓는다(2026-08-28).
// 한 줄 = 검토 한 건. 위에 입력 줄(10초 안에 적게 — 택1은 클릭, 시뮬레이션·항목은 제안), 아래에 그 해의 줄들.
// 오른쪽 위 셈: 건수 · 스펙 확정 전 이상 % · 관문 이상 % · 검증됨 % · 리드타임 중앙값 · 정착 후보.

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.75rem; flex: 1; min-height: 0;`;
const Bar = styled.div`display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;`;
const Chip = styled.button`
  padding: 0.3rem 0.7rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#e2e8f0')}; border-radius: 999px; font-family: inherit; font-size: 0.8125rem; cursor: pointer;
  background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
`;
const Select = styled.select`padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; background: white;`;
const Stats = styled.div`display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8125rem; color: #475569; strong { color: #1e293b; font-size: 1rem; }`;
const Up = styled.span`margin-left: 0.3rem; padding: 0 0.35rem; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 0.6875rem; font-weight: 600;`;
const Promote = styled.button`
  display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; background: #dcfce7; color: #166534;
  font-size: 0.75rem; font-weight: 600; border: 1px solid #86efac; font-family: inherit; cursor: pointer;
  &:hover { background: #bbf7d0; }
`;
const PromBack = styled.div`position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 70;`;
const PromBox = styled.div`
  width: min(46rem, 92vw); max-height: 80vh; display: flex; flex-direction: column; background: white; border-radius: 0.75rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3); overflow: hidden;
`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.9rem 1.1rem; border-bottom: 1px solid #e2e8f0; h3 { margin: 0; font-size: 1rem; flex: 1; color: #1e293b; }`;
const Body = styled.div`padding: 1rem 1.1rem; overflow: auto; display: flex; flex-direction: column; gap: 0.75rem;`;
const Why = styled.div`font-size: 0.8125rem; color: #64748b; line-height: 1.6;`;
const Cand = styled.table`
  width: 100%; border-collapse: collapse; font-size: 0.8125rem;
  th { text-align: left; font-weight: 600; color: #64748b; font-size: 0.75rem; padding: 0.3rem 0.4rem; border-bottom: 1px solid #e2e8f0; }
  td { padding: 0.4rem 0.4rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  td input { width: 100%; padding: 0.25rem 0.4rem; border: 1px solid #cbd5e1; border-radius: 0.3rem; font-family: inherit; font-size: 0.8125rem; }
  td small { color: #94a3b8; display: block; }
  td.act { text-align: right; white-space: nowrap; }
`;
// 입력 줄 — 택1은 드롭다운이 아니라 **토글 묶음**: 선택지가 한눈에 보이고 한 번 눌러 정한다(2026-08-28).
const Form = styled.form`
  display: flex; flex-direction: column; gap: 0.4rem;
  padding: 0.6rem 0.75rem; border: 1px solid #bfdbfe; background: #f8fbff; border-radius: 0.5rem;
  input { padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; min-width: 0; background: white; }
`;
const Line = styled.div`display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;`;
const Lab = styled.span`font-size: 0.75rem; font-weight: 700; color: #64748b; min-width: 4.5rem;`;
const Toggles = styled.div`display: inline-flex; gap: 0.25rem; flex-wrap: wrap;`;
const Tog = styled.button`
  padding: 0.28rem 0.65rem; border-radius: 999px; font-family: inherit; font-size: 0.8125rem; cursor: pointer; white-space: nowrap;
  border: 1px solid ${p => (p.$on ? (p.$cause ? '#d97706' : '#1d4ed8') : '#cbd5e1')};
  background: ${p => (p.$on ? (p.$cause ? '#f59e0b' : '#1d4ed8') : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
  &:hover { border-color: ${p => (p.$cause ? '#d97706' : '#1d4ed8')}; }
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
const Kind = styled.span`display: inline-block; padding: 0 0.45rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; background: ${p => (p.$cause ? '#fef3c7' : '#dbeafe')}; color: ${p => (p.$cause ? '#92400e' : '#1e40af')};`;
const Icon = styled.button`border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0.15rem; border-radius: 0.25rem; &:hover { color: #1d4ed8; background: #eff6ff; }`;
const Muted = styled.td`color: #94a3b8; font-style: italic;`;
const Notice = styled.div`display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.5rem 0.75rem; border-radius: 0.5rem; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.8125rem;`;
const Backdrop = styled.div`position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 60;`;
const Box = styled.div`width: min(52rem, 94vw); max-height: 88vh; display: flex; flex-direction: column; gap: 0.6rem; background: white; border-radius: 0.75rem; padding: 1rem 1.25rem; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3);`;
const Area = styled.textarea`width: 100%; min-height: 10rem; font-family: ui-monospace, monospace; font-size: 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; padding: 0.5rem;`;

const thisMonth = () => new Date().toISOString().slice(0, 7);
const empty = (kind = 'spec') => ({ month: thisMonth(), kind, target: '', item: '', agent_id: '', agent_name: '', timing: '', decision: '', basis: '', lead_days: '', note: '' });

const ReviewLedger = ({ divisionId, divisions = [], denyReason, review, refreshKey }) => {
  const allMode = divisionId === 'all';
  // 정착 후보 올리기 — 목록 창 하나, 줄마다 이름을 고쳐 올린다(2026-08-30)
  const [promoting, setPromoting] = useState(null);     // { kind, rows:[{agent_name,item,count,name}] }
  const [busyRow, setBusyRow] = useState(null);
  const [promoted, setPromoted] = useState({});         // {'수단×항목': 결과} — 올린 것
  const openPromote = (kindLabel, rows) => setPromoting({
    kindLabel, rows: rows.map(r => ({ ...r, name: r.item })),
  });
  const runPromote = async (row, makeAgent = false) => {
    const key = `${row.agent_name}×${row.item}`;
    setBusyRow(key); setError(null);
    try {
      const r = await maturityApi.promoteReview({
        division_id: division, agent_name: row.agent_name, item: row.item,
        subject_name: row.name, make_agent: makeAgent,
      });
      setPromoted(m => ({ ...m, [key]: r.data }));
      load();
    } catch (e) {
      // 사전에 없는 시뮬레이션이면 한 번 묻고 다시 — 말없이 만들지 않는다
      if (!makeAgent && String(e.message).includes('사전에 없습니다')
          && window.confirm(`「${row.agent_name}」 은 시뮬레이션 사전에 없습니다. 새로 만들어 올릴까요?`)) {
        await runPromote(row, true);
      } else { setError(e.message); }
    } finally { setBusyRow(null); }
  };
  const [division, setDivision] = useState(allMode ? (divisions[0]?.id ?? null) : divisionId);
  useEffect(() => { setDivision(allMode ? (divisions[0]?.id ?? null) : divisionId); }, [divisionId, allMode, divisions]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([new Date().getFullYear()]);
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [draft, setDraft] = useState(empty());
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const canEdit = !denyReason && division != null;

  const load = async () => {
    if (division == null) return;
    try {
      const [r, s, a, y] = await Promise.all([
        maturityApi.listReviews(division, year, kind), maturityApi.reviewStats(division, year),
        maturityApi.listAgents(division), maturityApi.reviewYears(division),
      ]);
      setRows(r.data || []); setStats(s.data); setAgents(a.data || []); setYears(y.data || [year]); setError(null);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [division, year, kind, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => [...new Set(rows.map(r => r.item).filter(Boolean))].sort(), [rows]);
  const targets = useMemo(() => [...new Set(rows.map(r => r.target).filter(Boolean))].sort(), [rows]);
  const opt = (field) => (review?.fields?.[field]?.options || []);
  const label = (field, key) => opt(field).find(o => o.key === key)?.label || '';
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    try {
      const payload = { ...draft, agent_id: draft.agent_id === '' ? null : Number(draft.agent_id), lead_days: draft.lead_days === '' ? null : Number(draft.lead_days) };
      if (editId) await maturityApi.updateReview(editId, payload);
      else await maturityApi.createReview(division, payload);
      setDraft(empty(draft.kind)); setEditId(null); setError(null);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const startEdit = (r) => {
    setEditId(r.id);
    setDraft({ month: r.month.slice(0, 7), kind: r.kind, target: r.target || '', item: r.item || '', agent_id: r.agent_id ?? '', agent_name: r.agent_name || '',
      timing: r.timing || '', decision: r.decision || '', basis: r.basis || '', lead_days: r.lead_days ?? '', note: r.note || '' });
  };
  const remove = async (r) => {
    if (!window.confirm(`${r.month.slice(0, 7)} ${r.item || ''} 건을 지울까요?`)) return;
    setBusy(true);
    try { await maturityApi.deleteReview(r.id); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const k = (key) => stats?.kinds?.[key];
  const pct = (v) => (v == null ? '—' : `${v}%`);

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
        <Chip $on={kind === ''} onClick={() => setKind('')}>전부</Chip>
        {(review?.kinds || []).map(x => <Chip key={x.key} $on={kind === x.key} onClick={() => setKind(x.key)}>{x.label}</Chip>)}
        <span style={{ flex: 1 }} />
        <Button type="button" onClick={() => setImporting(true)} disabled={!canEdit}><Upload size={13} /> CSV 가져오기</Button>
      </Bar>

      {stats && (
        <Stats>
          {(review?.kinds || []).map(x => {
            const s = k(x.key);
            return (
              <span key={x.key} title="건수 · 스펙 확정 전 이상 · 관문 이상 · 검증됨 · 리드타임 중앙값">
                <Kind $cause={x.key === 'cause'}>{x.label}</Kind> <strong>{s?.count ?? 0}건</strong>
                {' '}· 스펙 확정 전 이상 {pct(s?.early)} · 관문 이상 {pct(s?.gate)} · 검증됨 {pct(s?.confirmed)} · 리드타임 {s?.lead_median != null ? `${s.lead_median}일` : '—'}
                {(s?.promote || []).length > 0 && <> · <Promote type="button" onClick={() => openPromote(x.label, s.promote)}
                  title="누르면 상시 시험 항목으로 올릴 수 있습니다">정착 후보 {s.promote.length}</Promote></>}
              </span>
            );
          })}
        </Stats>
      )}

      {promoting && (
        <PromBack onClick={() => setPromoting(null)}>
          <PromBox onClick={e => e.stopPropagation()} role="dialog" aria-label="정착 후보 올리기">
            <Head><h3>정착 후보 — {promoting.kindLabel}</h3>
              <Button type="button" onClick={() => setPromoting(null)} title="닫기"><X size={14} /></Button></Head>
            <Body>
              <Why>
                한 해에 여러 번 되풀이된 해석입니다. <strong>상시 시험 항목으로 올리면</strong> 척도로 관리됩니다 —
                시험 항목과 시뮬레이션을 잇기만 하고 <strong>평가는 만들지 않습니다</strong>(근거는 사람이 적습니다).
                올려도 <strong>이 기록들은 그대로 남습니다</strong> — 기록은 사건이고 연계는 상태라 서로 다른 것을 셉니다.
                올린 짝은 다음부터 이 목록에 안 나옵니다.
              </Why>
              <Cand>
                <thead><tr><th style={{ width: '13rem' }}>시뮬레이션</th><th>시험 항목 이름</th><th style={{ width: '4rem' }}>건수</th><th style={{ width: '7rem' }} /></tr></thead>
                <tbody>
                  {promoting.rows.map((r, i) => {
                    const key = `${r.agent_name}×${r.item}`;
                    const done = promoted[key];
                    return (
                      <tr key={key}>
                        <td>{r.agent_name}</td>
                        <td>
                          {done ? done.subject_name : (
                            <>
                              <input value={r.name} aria-label={`${r.agent_name} 시험 항목 이름`}
                                     onChange={e => setPromoting(p => ({ ...p, rows: p.rows.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) }))} />
                              {r.name !== r.item && <small>기록에는 「{r.item}」</small>}
                            </>
                          )}
                        </td>
                        <td>{r.count}건</td>
                        <td className="act">
                          {done
                            ? <small>올렸습니다{done.made?.subject ? ' · 항목 새로' : ''}{done.made?.agent ? ' · 수단 새로' : ''}</small>
                            : <Button type="button" disabled={busyRow === key || !r.name.trim()} onClick={() => runPromote(r)}>
                                <ArrowUpRight size={13} /> 올리기
                              </Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Cand>
              {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
            </Body>
          </PromBox>
        </PromBack>
      )}

      {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
      {denyReason && <Notice as="div" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}><AlertTriangle size={14} /> <span>{denyReason} 읽기만 됩니다.</span></Notice>}

      {canEdit && (
        <Form onSubmit={submit} aria-label={editId ? '검토 건 고치기' : '검토 건 추가'}>
          <Line>
            <input type="month" value={draft.month} max={thisMonth()} onChange={e => set({ month: e.target.value })} aria-label="연-월" required style={{ width: '8rem' }} />
            <Toggles role="group" aria-label="종류">
              {(review?.kinds || []).map(x => <Tog key={x.key} type="button" $on={draft.kind === x.key} $cause={x.key === 'cause'} onClick={() => set({ kind: x.key })}>{x.label}</Tog>)}
            </Toggles>
            <input list="rv-targets" value={draft.target} onChange={e => set({ target: e.target.value })} placeholder="대상 — 제품·과제" aria-label="대상" style={{ flex: 1 }} />
            <input list="rv-items" value={draft.item} onChange={e => set({ item: e.target.value })} placeholder={draft.kind === 'cause' ? '불량 유형' : '스펙 항목'} aria-label="항목" style={{ flex: 1 }} />
            <span style={{ flex: 1.2, minWidth: '11rem' }}>
              <SearchSelect options={agents} value={draft.agent_id} onChange={(id) => set({ agent_id: id == null ? '' : id, agent_name: id == null ? draft.agent_name : '' })}
                            placeholder="시뮬레이션 찾기" hint="관리 목록에 없으면 아래에 이름만 적으세요." />
            </span>
            {draft.agent_id === '' && (
              <input value={draft.agent_name} onChange={e => set({ agent_name: e.target.value })} placeholder="시뮬레이션 이름(목록에 없을 때)" aria-label="시뮬레이션 이름" style={{ flex: 1 }} />
            )}
          </Line>
          {['timing', 'decision', 'basis'].map(field => (
            <Line key={field}>
              <Lab>{review?.fields?.[field]?.label}</Lab>
              <Toggles role="group" aria-label={review?.fields?.[field]?.label}>
                {opt(field).map(o => (
                  <Tog key={o.key} type="button" $on={draft[field] === o.key} aria-pressed={draft[field] === o.key}
                       onClick={() => set({ [field]: draft[field] === o.key ? '' : o.key })}>{o.label}</Tog>
                ))}
              </Toggles>
            </Line>
          ))}
          <Line>
            <Lab>리드타임</Lab>
            <input type="number" min="0" step="0.5" value={draft.lead_days} onChange={e => set({ lead_days: e.target.value })} placeholder="일" aria-label="리드타임(일)" title="리드타임(일)" style={{ width: '5rem' }} />
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>일</span>
            <input value={draft.note} onChange={e => set({ note: e.target.value })} placeholder="한 줄 메모 — 무엇을 보고 무엇을 정했나" aria-label="메모" style={{ flex: 1 }} />
            <Button type="submit" $primary disabled={busy || !draft.month || (draft.agent_id === '' && !draft.agent_name.trim())}>{editId ? <><Check size={13} /> 고침</> : <><Plus size={13} /> 추가</>}</Button>
            {editId && <Button type="button" onClick={() => { setEditId(null); setDraft(empty(draft.kind)); }}><X size={13} /> 취소</Button>}
          </Line>
          <datalist id="rv-targets">{targets.map(t => <option key={t} value={t} />)}</datalist>
          <datalist id="rv-items">{items.map(t => <option key={t} value={t} />)}</datalist>
        </Form>
      )}

      <Scroll>
        <Table>
          <thead><tr><th>연-월</th><th>종류</th><th>대상</th><th>항목</th><th>시뮬레이션</th><th>시점</th><th>결정 반영</th><th>판정 근거</th><th>리드타임</th><th>메모</th><th>누가</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><Muted colSpan={12}>{year}년에 적힌 건이 없습니다. 위 줄에 한 건씩 적거나 CSV 로 붙여 넣으세요.</Muted></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.month.slice(0, 7)}</td>
                <td><Kind $cause={r.kind === 'cause'}>{(review?.kinds || []).find(x => x.key === r.kind)?.label || r.kind}</Kind></td>
                <td>{r.target}</td>
                <td>{r.item}{r.promoted_pair_id && <Up title="상시 시험 항목으로 올린 건입니다 — 후보에는 다시 안 뜹니다">올림</Up>}</td>
                <td>{r.agent_name}</td>
                <td>{label('timing', r.timing)}</td><td>{label('decision', r.decision)}</td><td>{label('basis', r.basis)}</td>
                <td>{r.lead_days != null ? `${r.lead_days}일` : ''}</td>
                <td style={{ color: '#64748b' }}>{r.note}</td>
                <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{r.actor_name}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {canEdit && <><Icon onClick={() => startEdit(r)} title="고치기" aria-label="고치기"><Pencil size={13} /></Icon><Icon onClick={() => remove(r)} title="지우기" aria-label="지우기"><Trash2 size={13} /></Icon></>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Scroll>

      {importing && <ImportBox division={division} onClose={() => setImporting(false)} onDone={() => { setImporting(false); load(); }} />}
    </Wrap>
  );
};

/** CSV 가져오기 — 틀 내려받기 → 붙여 넣기 → 미리보기(줄별 문제) → 넣기. 스팟성 일은 엑셀에 있다. */
const ImportBox = ({ division, onClose, onDone }) => {
  const [text, setText] = useState('');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const preview = async () => {
    setBusy(true);
    try { const r = await maturityApi.reviewImportPreview(division, text); setPlan(r.data); setError(null); }
    catch (e) { setError(e.message); setPlan(null); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true);
    try { await maturityApi.reviewImportApply(division, text); onDone(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Backdrop onClick={onClose}>
      <Box onClick={e => e.stopPropagation()} role="dialog" aria-label="해석 활용 기록 CSV 가져오기">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <strong style={{ flex: 1 }}>해석 활용 기록 CSV 가져오기</strong>
          <Button type="button" as="a" href={maturityApi.reviewTemplateUrl()} download><Download size={13} /> 틀 내려받기</Button>
          <Icon onClick={onClose} aria-label="닫기"><X size={16} /></Icon>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>틀의 머리글 그대로, 엑셀에서 복사해 붙여 넣으세요(탭·쉼표 둘 다 됩니다). 시점·결정 반영·판정 근거는 화면의 글자 그대로 적으면 됩니다.</div>
        <Area value={text} onChange={e => { setText(e.target.value); setPlan(null); }} placeholder="연-월	종류	대상	항목	시뮬레이션	시점	결정 반영	판정 근거	리드타임(일)	메모" />
        {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
        {plan && (
          <div style={{ fontSize: '0.8125rem' }}>
            넣을 건 <strong>{plan.count}</strong>{plan.problems.length > 0 && <> · 문제 <strong style={{ color: '#991b1b' }}>{plan.problems.length}</strong>줄</>}
            {plan.problems.length > 0 && <ul style={{ margin: '0.3rem 0 0 1rem', color: '#991b1b' }}>{plan.problems.slice(0, 8).map(p => <li key={p.line}>{p.line}줄: {p.message}</li>)}</ul>}
            {plan.items.some(i => !i.agent_known) && <div style={{ color: '#92400e', marginTop: '0.3rem' }}>관리 목록에 없는 시뮬레이션 이름이 {plan.items.filter(i => !i.agent_known).length}건 — 이름만 적힙니다.</div>}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <Button type="button" onClick={onClose}>닫기</Button>
          <Button type="button" onClick={preview} disabled={busy || !text.trim()}>미리보기</Button>
          <Button type="button" $primary onClick={apply} disabled={busy || !plan || plan.problems.length > 0 || plan.count === 0}>{plan ? `${plan.count}건 넣기` : '넣기'}</Button>
        </div>
      </Box>
    </Backdrop>
  );
};

export default ReviewLedger;
