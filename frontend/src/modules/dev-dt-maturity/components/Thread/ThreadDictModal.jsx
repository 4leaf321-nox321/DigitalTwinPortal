import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Check, Plus, Trash2, AlertTriangle, Merge } from 'lucide-react';
import maturityApi from '../../services/maturityApi';

// 디지털 스레드의 사전 관리 창(2026-08-28) — 시스템 · 조직 · 스레드(사무국).
// 시뮬레이션 관리와 같은 문법: 왼쪽 목록(위에 빠른 추가), 오른쪽 상세.
//   시스템: 전사 하나. 이름·종류·주관 조직·생애 단계·연계 수단·상태. 처음 적은 사업부나 사무국이 고친다. 사무국은 「합치기」(정돈).
//   조직: 사업부의 것. **포탈 부서는 저절로 들어온다**(2026-08-30) — 단추를 눌러야 채워지면
//         대개 안 채워진다. 없어진 부서는 지우지 않고 짚어 주고, 안 쓰는 것만 정리한다.
//   스레드: 사무국만. 이름·설명·안 쓰는 축·표준 구간(단계 → 단계).

const Backdrop = styled.div`position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 60;`;
const Box = styled.div`width: min(64rem, 96vw); height: min(40rem, 90vh); display: flex; flex-direction: column; background: white; border-radius: 0.75rem; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3); overflow: hidden;`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem 1.1rem; border-bottom: 1px solid #e2e8f0; h3 { margin: 0; font-size: 1rem; color: #1e293b; flex: 1; }`;
const IconBtn = styled.button`border: none; background: transparent; color: #64748b; cursor: pointer; padding: 0.25rem; border-radius: 0.3rem; &:hover { background: #f1f5f9; }`;
const Body = styled.div`display: grid; grid-template-columns: 18rem minmax(0, 1fr); flex: 1; min-height: 0;`;
const Left = styled.div`display: flex; flex-direction: column; border-right: 1px solid #e2e8f0; background: #f8fafc; min-height: 0;`;
const Quick = styled.form`display: flex; gap: 0.3rem; padding: 0.5rem; border-bottom: 1px solid #e2e8f0; input, select { padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; min-width: 0; flex: 1; background: white; }`;
const List = styled.div`flex: 1; min-height: 0; overflow: auto;`;
const Item = styled.button`
  display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; width: 100%; text-align: left; border: none; font-family: inherit; cursor: pointer;
  padding: 0.45rem 0.8rem; font-size: 0.8125rem; color: #1e293b; background: ${p => (p.$on ? '#dbeafe' : 'transparent')};
  &:hover { background: ${p => (p.$on ? '#dbeafe' : '#eef2f7')}; } small { color: #94a3b8; font-size: 0.6875rem; white-space: nowrap; }
`;
const Right = styled.div`padding: 0.9rem 1.1rem; overflow: auto; display: flex; flex-direction: column; gap: 0.6rem; min-height: 0;`;
const Field = styled.label`display: grid; grid-template-columns: 7rem minmax(0, 1fr); align-items: center; gap: 0.5rem; font-size: 0.8125rem; color: #334155; input, select, textarea { padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; min-width: 0; } small { grid-column: 2; color: #94a3b8; font-size: 0.6875rem; }`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 0.25rem;`;
const Chip = styled.button`padding: 0.15rem 0.55rem; border-radius: 999px; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')}; font-family: inherit; font-size: 0.75rem; cursor: pointer;`;
const Foot = styled.div`display: flex; gap: 0.5rem; align-items: center; padding: 0.6rem 1.1rem; border-top: 1px solid #e2e8f0; background: #f8fafc;`;
const Button = styled.button`
  padding: 0.35rem 0.8rem; border: 1px solid ${p => (p.$primary ? '#1d4ed8' : p.$danger ? '#fecaca' : '#cbd5e1')}; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  background: ${p => (p.$primary ? '#1d4ed8' : 'white')}; color: ${p => (p.$primary ? 'white' : p.$danger ? '#b91c1c' : '#475569')}; display: inline-flex; gap: 0.3rem; align-items: center;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const Notice = styled.div`display: flex; gap: 0.4rem; align-items: flex-start; font-size: 0.8125rem; color: #991b1b;`;
const Muted = styled.div`font-size: 0.8125rem; color: #94a3b8;`;
const Gone = styled.span`color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 0.25rem; padding: 0 0.3rem; font-size: 0.6875rem;`;
const Tabs = styled.div`display: flex; gap: 0.25rem;`;
const Tab = styled.button`padding: 0.3rem 0.8rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#e2e8f0')}; border-radius: 999px; background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')}; font-family: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer;`;
const SegRow = styled.div`display: grid; grid-template-columns: minmax(0, 1fr) 7rem 1rem 7rem 1.6rem; & + & { margin-top: 0.15rem; } gap: 0.3rem; align-items: center; font-size: 0.8125rem; input, select { padding: 0.25rem 0.4rem; border: 1px solid #cbd5e1; border-radius: 0.3rem; font-family: inherit; font-size: 0.8125rem; min-width: 0; }`;

/** 목록 + 「이미 적혀 있는데 목록엔 없는 값」. 안 보이면 사람이 모르는 채로 덮어쓴다(2026-08-30). */
const withStray = (rows, current, what) => {
  const list = rows || [];
  const many = Array.isArray(current) ? current : [current];
  const stray = many.filter(v => v && !list.some(x => x.key === v))
    .map(v => ({ key: v, label: `${v} — 없는 ${what}`, stray: true }));
  return [...list, ...stray];
};

const ThreadDictModal = ({ kind: initialKind = 'system', divisionId, divisions = [], thread, axes = [], canCurate = false, denyReason, onClose, onChanged }) => {
  const [kind, setKind] = useState(initialKind);
  const [division, setDivision] = useState(divisionId === 'all' ? (divisions[0]?.id ?? null) : divisionId);
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null);
  const [quick, setQuick] = useState('');
  const [quickKind, setQuickKind] = useState('other');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mergeInto, setMergeInto] = useState('');
  const stages = thread?.stages || [];
  const kinds = thread?.system_kinds || [];
  const canEditKind = kind === 'thread' ? canCurate : !denyReason;

  const load = async () => {
    try {
      if (kind === 'system') setRows((await maturityApi.listSystems()).data || []);
      // 포탈 부서는 목록을 읽을 때 서버가 알아서 맞춰 온다 — 따로 가져올 것이 없다
      else if (kind === 'org') { setRows(division != null ? (await maturityApi.listOrgs(division)).data || [] : []); }
      else setRows((await maturityApi.listThreads(true)).data || []);
      setError(null);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { setSel(null); setDraft(null); load(); }, [kind, division]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = useMemo(() => rows.find(r => r.id === sel) || null, [rows, sel]);
  useEffect(() => { setDraft(current ? JSON.parse(JSON.stringify(current)) : null); }, [current]);
  const set = (p) => setDraft(d => ({ ...d, ...p }));
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(current);

  const add = async (e) => {
    e.preventDefault();
    const name = quick.trim();
    if (!name) return;
    setBusy(true);
    try {
      let r;
      if (kind === 'system') r = await maturityApi.createSystem({ name, kind: quickKind });
      else if (kind === 'org') r = await maturityApi.createOrg({ division_id: division, name });
      else r = await maturityApi.createThread({ key: name.toLowerCase().replace(/\s+/g, '_'), name });
      setQuick(''); await load(); setSel(r.data.id); setError(null); if (onChanged) onChanged();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      if (kind === 'system') await maturityApi.updateSystem(draft.id, draft);
      else if (kind === 'org') await maturityApi.updateOrg(draft.id, draft);
      else {
        await maturityApi.updateThread(draft.id, { name: draft.name, description: draft.description, axes_off: draft.axes_off, is_active: draft.is_active });
        for (const s of draft.segments || []) {
          const was = (current.segments || []).find(x => x.id === s.id);
          if (s.id < 0) await maturityApi.addSegmentDef(draft.id, { key: s.key || `s${Date.now()}`, name: s.name, from_stage: s.from_stage, to_stage: s.to_stage, data_kinds: s.data_kinds || [] });
          else if (was && JSON.stringify(was) !== JSON.stringify(s)) await maturityApi.updateSegmentDef(s.id, { name: s.name, from_stage: s.from_stage, to_stage: s.to_stage, data_kinds: s.data_kinds || [] });
        }
        for (const was of current.segments || []) if (!(draft.segments || []).some(s => s.id === was.id)) await maturityApi.deleteSegmentDef(was.id);
      }
      await load(); setError(null); if (onChanged) onChanged();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!current || !window.confirm(`「${current.name}」을 지울까요?`)) return;
    setBusy(true);
    try {
      if (kind === 'system') await maturityApi.deleteSystem(current.id);
      else if (kind === 'org') await maturityApi.deleteOrg(current.id);
      else await maturityApi.updateThread(current.id, { is_active: false });
      setSel(null); await load(); setError(null); if (onChanged) onChanged();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const merge = async () => {
    if (!current || !mergeInto || !window.confirm(`「${current.name}」을 「${rows.find(r => r.id === Number(mergeInto))?.name}」으로 합칠까요? 쓰는 구간이 옮겨 가고 「${current.name}」은 사라집니다.`)) return;
    setBusy(true);
    try { await maturityApi.mergeSystems(Number(mergeInto), current.id); setSel(Number(mergeInto)); setMergeInto(''); await load(); if (onChanged) onChanged(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  // 포탈에서 없어진 조직 — 지우지 않고 짚어 준다. 안 쓰는 것만 정리한다(2026-08-30).
  const goneRows = kind === 'org' ? rows.filter(r => r.gone) : [];
  const freeGone = goneRows.filter(r => !r.usage).length;
  const prune = async () => {
    if (!window.confirm(`쓰는 구간이 없는 ${freeGone}개를 지웁니다. 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try { await maturityApi.pruneOrgs(division); await load(); if (onChanged) onChanged(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const title = { system: '시스템 관리', org: '조직 관리', thread: '스레드 정의' }[kind];
  return (
    <Backdrop onClick={onClose}>
      <Box onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <Head>
          <h3>{title}</h3>
          <Tabs>
            <Tab type="button" $on={kind === 'system'} onClick={() => setKind('system')}>시스템</Tab>
            <Tab type="button" $on={kind === 'org'} onClick={() => setKind('org')}>조직</Tab>
            {canCurate && <Tab type="button" $on={kind === 'thread'} onClick={() => setKind('thread')}>스레드 정의</Tab>}
          </Tabs>
          <IconBtn onClick={onClose} title="닫기" aria-label="닫기"><X size={16} /></IconBtn>
        </Head>
        <Body>
          <Left>
            {kind === 'org' && divisionId === 'all' && (
              <select value={division ?? ''} onChange={e => setDivision(Number(e.target.value))} aria-label="사업부" style={{ margin: '0.5rem 0.5rem 0', fontFamily: 'inherit', fontSize: '0.8125rem', padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            {canEditKind && (
              <Quick onSubmit={add}>
                {kind === 'system' && (
                  <select value={quickKind} onChange={e => setQuickKind(e.target.value)} aria-label="종류" style={{ flex: '0 0 6.5rem' }}>
                    {kinds.filter(k => k.key !== 'informal').map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                )}
                <input value={quick} onChange={e => setQuick(e.target.value)} placeholder={kind === 'system' ? '시스템 이름 — Enter' : kind === 'org' ? '조직 이름 — Enter' : '스레드 이름 — Enter'} aria-label={`${title} 빠른 추가`} />
                <Button type="submit" $primary disabled={busy || !quick.trim()} title="추가"><Plus size={13} /></Button>
              </Quick>
            )}
            <List>
              {rows.map(r => (
                <Item key={r.id} type="button" $on={sel === r.id} onClick={() => setSel(r.id)}>
                  <span>{r.name}</span>
                  <small>{kind === 'system' ? (kinds.find(k => k.key === r.kind)?.label || r.kind)
                    : kind === 'org' ? (r.gone
                      ? <Gone title={r.usage ? `구간 ${r.usage}개가 쓰고 있어 지우지 않습니다` : '쓰는 구간이 없습니다'}>없어진 부서{r.usage ? ` · 쓰임 ${r.usage}` : ''}</Gone>
                      : (stages.find(s => s.key === r.role)?.label || ''))
                    : `구간 ${(r.segments || []).length}`}</small>
                </Item>
              ))}
              {rows.length === 0 && <Muted style={{ padding: '0.8rem' }}>아직 없습니다.</Muted>}
            </List>
            {kind === 'org' && (
              <div style={{ borderTop: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', fontSize: '0.75rem', color: '#64748b' }}>
                {goneRows.length === 0
                  ? <span>포탈의 부서 표를 그대로 따릅니다 — 새 부서는 저절로 들어오고, 이름이 바뀌면 따라갑니다.</span>
                  : (
                    <>
                      <div style={{ fontWeight: 700, marginBottom: '0.2rem', color: '#92400e' }}>없어진 부서 {goneRows.length}</div>
                      <div>포탈에서 사라졌거나 꺼진 부서입니다. <strong>지우지 않았습니다</strong> — 구간이 가리키고 있을 수 있습니다.
                        {freeGone > 0 ? ` 그중 ${freeGone}개는 쓰는 구간이 없습니다.` : ' 전부 쓰이고 있어 정리할 것이 없습니다.'}</div>
                      {canEditKind && freeGone > 0 && (
                        <Button type="button" style={{ marginTop: '0.35rem' }} disabled={busy} onClick={prune}>
                          안 쓰는 {freeGone}개 정리
                        </Button>
                      )}
                    </>
                  )}
              </div>
            )}
          </Left>
          <Right>
            {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
            {!draft && <Muted>왼쪽에서 고르거나 위에 이름을 적어 넣으세요.</Muted>}
            {draft && kind === 'system' && (
              <>
                <Field><span>이름</span><input value={draft.name || ''} onChange={e => set({ name: e.target.value })} disabled={!canEditKind || draft.kind === 'informal'} aria-label="시스템 이름" /></Field>
                <Field><span>종류</span>
                  <select value={draft.kind || 'other'} onChange={e => set({ kind: e.target.value })} disabled={!canEditKind || draft.kind === 'informal'} aria-label="시스템 종류">
                    {withStray(kinds, draft.kind, '종류').map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                </Field>
                <Field><span>주관 조직</span><input value={draft.owner_org || ''} onChange={e => set({ owner_org: e.target.value })} disabled={!canEditKind} placeholder="예: IT 기획, PLM 운영팀" /></Field>
                <Field><span>생애 단계</span>
                  <Chips>{withStray(stages, draft.stages, '단계').map(s => <Chip key={s.key} type="button" $on={(draft.stages || []).includes(s.key)} disabled={!canEditKind}
                    onClick={() => set({ stages: (draft.stages || []).includes(s.key) ? draft.stages.filter(x => x !== s.key) : [...(draft.stages || []), s.key] })}>{s.label}</Chip>)}</Chips>
                </Field>
                <Field><span>연계 수단</span>
                  <Chips>{withStray(thread?.link_means, draft.link_means, '수단').map(m => <Chip key={m.key} type="button" $on={draft.link_means === m.key} disabled={!canEditKind || draft.kind === 'informal'} onClick={() => set({ link_means: m.key })}>{m.label}</Chip>)}</Chips>
                  <small>API 가 있으면 어떤 구간이든 연동 후보. 「미확인」이면 허브도에 미확인으로 셉니다.</small>
                </Field>
                <Field><span>상태</span>
                  <Chips>{withStray(thread?.system_status, draft.status, '상태').map(m => <Chip key={m.key} type="button" $on={draft.status === m.key} disabled={!canEditKind} onClick={() => set({ status: m.key })}>{m.label}</Chip>)}</Chips>
                </Field>
                <Field><span>메모</span><input value={draft.note || ''} onChange={e => set({ note: e.target.value })} disabled={!canEditKind} /></Field>
                {canCurate && draft.kind !== 'informal' && (
                  <Field><span>정돈(합치기)</span>
                    <span style={{ display: 'flex', gap: '0.3rem' }}>
                      <select value={mergeInto} onChange={e => setMergeInto(e.target.value)} aria-label="합칠 대상" style={{ flex: 1 }}>
                        <option value="">— 이 시스템을 어디로 합칠까 —</option>
                        {rows.filter(r => r.id !== draft.id && r.kind !== 'informal').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <Button type="button" disabled={!mergeInto || busy} onClick={merge}><Merge size={13} /> 합치기</Button>
                    </span>
                    <small>같은 시스템이 다른 글자로 쌓였을 때 — 쓰는 구간이 옮겨 가고 이 항목은 사라집니다.</small>
                  </Field>
                )}
              </>
            )}
            {draft && kind === 'org' && (
              <>
                <Field><span>이름</span><input value={draft.name || ''} onChange={e => set({ name: e.target.value })} disabled={!canEditKind} aria-label="조직 이름" /></Field>
                <Field><span>생애 단계 역할</span>
                  <Chips>{stages.map(s => <Chip key={s.key} type="button" $on={draft.role === s.key} disabled={!canEditKind} onClick={() => set({ role: draft.role === s.key ? null : s.key })}>{s.label}</Chip>)}</Chips>
                </Field>
                <Field><span>출처</span><span style={{ color: '#64748b' }}>{{ portal: '포탈 부서', process: '프로세스 노드', manual: '직접 적음' }[draft.source_kind] || draft.source_kind}{draft.source_id ? ` #${draft.source_id}` : ''}</span></Field>
                <Field><span>메모</span><input value={draft.note || ''} onChange={e => set({ note: e.target.value })} disabled={!canEditKind} /></Field>
              </>
            )}
            {draft && kind === 'thread' && (
              <>
                <Field><span>이름</span><input value={draft.name || ''} onChange={e => set({ name: e.target.value })} aria-label="스레드 이름" /></Field>
                <Field><span>key</span><span style={{ color: '#64748b' }}>{draft.key} — 고정</span></Field>
                <Field><span>설명</span><input value={draft.description || ''} onChange={e => set({ description: e.target.value })} /></Field>
                <Field><span>안 쓰는 축</span>
                  <Chips>{axes.map(a => <Chip key={a.key} type="button" $on={(draft.axes_off || []).includes(a.key)} onClick={() => set({ axes_off: (draft.axes_off || []).includes(a.key) ? draft.axes_off.filter(x => x !== a.key) : [...(draft.axes_off || []), a.key] })}>{a.label}</Chip>)}</Chips>
                  <small>켜 둔 축은 이 스레드의 구간에서 안 묻습니다(예: 시뮬레이션 스레드는 데이터 정합을 끔).</small>
                </Field>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>표준 구간 — 단계 → 단계</div>
                {(draft.segments || []).map((s, i) => (
                  <SegRow key={s.id}>
                    <input value={s.name} onChange={e => set({ segments: draft.segments.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="구간 이름" />
                    <select value={s.from_stage} onChange={e => set({ segments: draft.segments.map((x, j) => (j === i ? { ...x, from_stage: e.target.value } : x)) })}>{stages.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}</select>
                    <span>→</span>
                    <select value={s.to_stage} onChange={e => set({ segments: draft.segments.map((x, j) => (j === i ? { ...x, to_stage: e.target.value } : x)) })}>{stages.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}</select>
                    <IconBtn type="button" title="빼기" onClick={() => set({ segments: draft.segments.filter((_, j) => j !== i) })}><Trash2 size={12} /></IconBtn>
                    <Chips style={{ gridColumn: '1 / -1', marginBottom: '0.3rem' }}>
                      {(thread?.data_kinds || []).map(k => <Chip key={k.key} type="button" $on={(s.data_kinds || []).includes(k.key)}
                        onClick={() => set({ segments: draft.segments.map((x, j) => (j === i ? { ...x, data_kinds: (x.data_kinds || []).includes(k.key) ? x.data_kinds.filter(y => y !== k.key) : [...(x.data_kinds || []), k.key] } : x)) })}>{k.label}</Chip>)}
                    </Chips>
                  </SegRow>
                ))}
                <Button type="button" onClick={() => set({ segments: [...(draft.segments || []), { id: -Date.now(), key: '', name: '', from_stage: stages[1]?.key || '', to_stage: stages[2]?.key || '' }] })}><Plus size={13} /> 표준 구간 더하기</Button>
              </>
            )}
          </Right>
        </Body>
        <Foot>
          {draft && canEditKind && (kind !== 'system' || draft.kind !== 'informal') && <Button type="button" $danger onClick={remove} disabled={busy}><Trash2 size={13} /> {kind === 'thread' ? '숨기기' : '지우기'}</Button>}
          <span style={{ flex: 1 }} />
          <Button type="button" onClick={onClose}>닫기</Button>
          {draft && canEditKind && <Button type="button" $primary disabled={busy || !dirty} onClick={save}><Check size={13} /> 저장</Button>}
        </Foot>
      </Box>
    </Backdrop>
  );
};

export default ThreadDictModal;
