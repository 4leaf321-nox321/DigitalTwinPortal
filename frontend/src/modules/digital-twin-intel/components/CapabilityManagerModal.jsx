import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Loader2, Trash2, Plus, Wrench, Users, AlertTriangle } from 'lucide-react';

import api from '../services/api';

/**
 * **역량 관리** — 63개를 한 자리에서 본다.
 *
 * 왜 만들었나
 *     도구에는 「도구 관리」가 있는데 역량에는 없었다. 역량을 고치려면 레이더에서
 *     점을 찾아 창을 열어야 했고, **점이 없는 역량은 아예 못 찾았다** — 아무 사업부도
 *     안 적은 48개가 그렇다. 관리하는 자리가 없으면 그 48개는 손댈 방법이 없다.
 *
 * ⚠️⚠️ **역량에는 단계가 없다**(2026-08-26). 여기에도 단계 칸을 두면 안 된다 —
 *    단계는 사업부마다 답이 달라서 사업부 줄에만 산다. 대신 **누가 적었나**를
 *    보여준다: 그것이 이 역량이 살아 있는지를 말해 주는 유일한 신호다.
 *
 * ⚠️ 공급사ㆍ제품 URL 같은 칸도 없다. 그건 도구의 것이다 — 역량은 「무엇을 할 수
 *    있어야 하는가」이지 제품이 아니다.
 */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const Panel = styled.div`
  background: #fff;
  border-radius: 0.75rem;
  width: min(82rem, 96vw);
  height: 86vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;

  h2 { margin: 0; font-size: 0.9375rem; color: #0f172a; }
  small { font-size: 0.75rem; color: #64748b; }
  > button.x {
    margin-left: auto;
    border: none;
    background: none;
    cursor: pointer;
    color: #64748b;
    display: inline-flex;
  }
`;

const Two = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 22rem 1fr;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

const Left = styled.div`
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const List = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.5rem;
`;

const Sector = styled.h3`
  margin: 0.625rem 0 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #6366f1;
  display: flex;
  align-items: center;
  gap: 0.375rem;

  span { flex: 1; height: 1px; background: #e0e7ff; }
`;

const Pick = styled.button`
  width: 100%;
  text-align: left;
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : 'transparent')};
  background: ${(p) => (p.$on ? '#eef2ff' : 'transparent')};
  border-radius: 0.375rem;
  padding: 0.3125rem 0.4375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font: inherit;

  &:hover { background: #f1f5f9; }

  b {
    flex: 1;
    min-width: 0;
    font-size: 0.8125rem;
    font-weight: ${(p) => (p.$on ? 700 : 400)};
    color: #0f172a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  em {
    font-style: normal;
    font-size: 0.6875rem;
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
  }
`;

/* ⚠️ **아무도 안 적은 역량을 눈에 띄게 한다.** 그것이 이 화면에서 할 일이다. */
const Quiet = styled.em`
  color: #f59e0b !important;
`;

const NewRow = styled.div`
  border-top: 1px solid #e2e8f0;
  padding: 0.5rem;
  display: flex;
  gap: 0.25rem;

  input, select {
    font-size: 0.75rem;
    padding: 0.3125rem 0.4375rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.3125rem;
    min-width: 0;
  }
  input { flex: 1; }
  button {
    border: none;
    background: #4f46e5;
    color: #fff;
    border-radius: 0.3125rem;
    padding: 0 0.625rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    &:disabled { background: #c7d2fe; cursor: not-allowed; }
  }
`;

const Right = styled.div`
  min-height: 0;
  overflow-y: auto;
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  > span {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #475569;
  }
  input, textarea, select {
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.375rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    resize: vertical;
  }
  textarea { min-height: 4rem; }
`;

const Pair = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.625rem;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;

const Box = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;

  > h4 {
    margin: 0 0 0.375rem;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #475569;
    display: flex;
    align-items: center;
    gap: 0.3125rem;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;

  span {
    font-size: 0.6875rem;
    padding: 0.0625rem 0.4375rem;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
  }
  i {
    font-style: normal;
    font-size: 0.6875rem;
    color: #cbd5e1;
  }
`;

const CptBtn = styled.button`
  font-size: 0.6875rem;
  padding: 0.0625rem 0.4375rem;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.6875rem;
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#eef2ff' : '#fff')};
  color: ${(p) => (p.$on ? '#3730a3' : '#94a3b8')};
  font-weight: ${(p) => (p.$on ? 600 : 400)};
  &:disabled { cursor: default; }
`;

const Who = styled.span`
  background: ${(p) => p.$bg} !important;
  color: ${(p) => p.$color} !important;
  font-weight: 600;
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const Note = styled.small`
  font-size: 0.6875rem;
  color: #64748b;
`;

const Save = styled.button`
  border: none;
  background: #4f46e5;
  color: #fff;
  font-weight: 600;
  font-size: 0.8125rem;
  padding: 0.4375rem 0.9375rem;
  border-radius: 0.375rem;
  cursor: pointer;
  &:disabled { background: #c7d2fe; cursor: not-allowed; }
`;

const Ghost = styled.button`
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-size: 0.8125rem;
  padding: 0.4375rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
`;

const Danger = styled(Ghost)`
  border-color: #fecaca;
  color: #b91c1c;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
`;

const Msg = styled.p`
  margin: 0;
  padding: 2rem;
  text-align: center;
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const UNSORTED = '분류 없음';
const listOf = (s) => s.split(/[,·]/).map((x) => x.trim()).filter(Boolean);
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const CapabilityManagerModal = ({ isOpen, tech, categories, cptGroups,
                                 canWrite, canCurate, onClose, onChanged,
                                 showError }) => {
  const [pick, setPick] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState('');
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('');

  const caps = useMemo(
    () => (tech || []).filter((t) => t.kind === 'capability'), [tech]);
  const tools = useMemo(
    () => (tech || []).filter((t) => t.kind !== 'capability'), [tech]);

  /* 역량마다 매달린 도구. ⚠️ 한 도구가 여러 역량에 걸린다 — 세면 겹친다. */
  const kidsOf = useMemo(() => {
    const m = {};
    tools.forEach((t) => (t.capabilityUuids || []).forEach((c) => {
      (m[c] = m[c] || []).push(t);
    }));
    return m;
  }, [tools]);

  const sectors = useMemo(() => {
    const by = new Map();
    caps.forEach((c) => {
      const g = c.category || UNSORTED;
      if (!by.has(g)) by.set(g, []);
      by.get(g).push(c);
    });
    const ordered = (categories || []).filter((g) => by.has(g));
    [...by.keys()].forEach((g) => { if (!ordered.includes(g)) ordered.push(g); });
    return ordered.map((g) => [g, by.get(g)]);
  }, [caps, categories]);

  if (!isOpen) return null;

  const current = caps.find((c) => c.uuid === pick) || caps[0] || null;

  const asDraft = (c) => ({
    name: c.name || '',
    summary: c.summary || '',
    description: c.description || '',
    category: c.category || '',
    tags: (c.tags || []).join(', '),
    cpt: c.cpt || [],
    aliases: (c.aliases || []).join(', '),
  });

  const d = (draft && draft.uuid === (current && current.uuid))
    ? draft : (current ? { uuid: current.uuid, ...asDraft(current) } : null);

  const set = (patch) => setDraft({ ...d, ...patch });

  const changed = Boolean(current && d) && (
    d.name.trim() !== (current.name || '')
    || d.summary !== (current.summary || '')
    || d.description !== (current.description || '')
    || d.category !== (current.category || '')
    || !sameList(listOf(d.tags), current.tags || [])
    || !sameList(d.cpt, current.cpt || [])
    || !sameList(listOf(d.aliases), current.aliases || []));

  const run = async (id, fn, msg) => {
    setBusy(id);
    try {
      await fn();
      await onChanged(msg);
    } catch (e) {
      if (showError) showError(e.message);
    } finally {
      setBusy('');
    }
  };

  const save = () => run('save', async () => {
    await api.updateTech(current.uuid, {
      name: d.name.trim(),
      summary: d.summary,
      description: d.description,
      category: d.category,
      tags: listOf(d.tags),
      cpt: d.cpt,
      aliases: listOf(d.aliases),
    });
    setDraft(null);
  }, `「${d.name.trim()}」 을 고쳤습니다.`);

  const add = () => {
    const n = newName.trim();
    if (!n) return;
    run('add', async () => {
      /*
        ⚠️ **단계를 안 보낸다.** 역량은 단계를 안 갖는다 — 서버도 버리지만, 여기서
           보내면 「그런 것이 있나 보다」로 읽히고 다음 사람이 칸을 만든다.
      */
      await api.createTech({ name: n, kind: 'capability',
                             category: newCat || undefined });
      setNewName('');
    }, `역량 「${n}」 을 넣었습니다.`);
  };

  const remove = () => {
    const kids = (kidsOf[current.uuid] || []).length;
    const said = (current.divisionMarks || []).length;
    const warn = `「${current.name}」 을 지웁니다.`
      + (kids ? ` 매달린 도구 ${kids}개는 안 지워지고 떨어져 나옵니다 (미아가 됩니다).` : '')
      + (said ? ` 사업부 ${said}곳이 적어 둔 것도 함께 사라집니다.` : '')
      + ' 되돌릴 수 없습니다.';
    // eslint-disable-next-line no-alert
    if (!window.confirm(warn)) return;
    run('del', () => api.deleteTech(current.uuid), `「${current.name}」 을 지웠습니다.`);
  };

  const toggleCpt = (k) => set({
    cpt: d.cpt.includes(k) ? d.cpt.filter((x) => x !== k) : [...d.cpt, k],
  });

  const quiet = caps.filter((c) => !(c.divisionMarks || []).length).length;

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Head>
          <h2>역량 관리</h2>
          <small>
            {caps.length}개
            {/* ⚠️ 이 숫자가 이 화면에서 할 일이다 — 손 안 탄 역량. */}
            {quiet > 0 && ` · 아직 아무 사업부도 안 적은 것 ${quiet}개`}
          </small>
          <button type="button" className="x" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </Head>

        <Two>
          <Left>
            <List>
              {caps.length === 0 && <Msg>역량이 없습니다.</Msg>}
              {sectors.map(([g, items]) => (
                <React.Fragment key={g}>
                  <Sector>{g} <span /></Sector>
                  {items.map((c) => {
                    const said = (c.divisionMarks || []).length;
                    return (
                      <Pick key={c.uuid} type="button"
                            $on={current && current.uuid === c.uuid}
                            onClick={() => { setPick(c.uuid); setDraft(null); }}>
                        <b>{c.name}</b>
                        <em title="매달린 도구">
                          <Wrench size={10} />{(kidsOf[c.uuid] || []).length}
                        </em>
                        {said > 0 ? (
                          <em title={`적은 사업부: ${c.divisionMarks.map((m) => m.division).join(' · ')}`}>
                            <Users size={10} />{said}
                          </em>
                        ) : (
                          <Quiet title="아직 아무 사업부도 안 적었습니다 — 레이더에 점이 없습니다">
                            <AlertTriangle size={10} />
                          </Quiet>
                        )}
                      </Pick>
                    );
                  })}
                </React.Fragment>
              ))}
            </List>

            {canWrite && (
              <NewRow>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                       placeholder="새 역량 이름"
                       onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
                <select value={newCat} onChange={(e) => setNewCat(e.target.value)}>
                  <option value="">분야</option>
                  {(categories || []).map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <button type="button" onClick={add}
                        disabled={!newName.trim() || busy === 'add'}>
                  {busy === 'add' ? <Loader2 size={13} /> : <Plus size={13} />}
                </button>
              </NewRow>
            )}
          </Left>

          <Right>
            {!current && <Msg>왼쪽에서 역량을 고르세요.</Msg>}
            {current && d && (
              <>
                <Field>
                  <span>이름</span>
                  <input value={d.name} disabled={!canWrite}
                         onChange={(e) => set({ name: e.target.value })} />
                </Field>

                <Pair>
                  <Field>
                    <span>분야</span>
                    <select value={d.category} disabled={!canWrite}
                            onChange={(e) => set({ category: e.target.value })}>
                      <option value="">{UNSORTED}</option>
                      {(categories || []).map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </Field>
                  <Field>
                    <span>다르게 부르는 이름 (쉼표로)</span>
                    <input value={d.aliases} disabled={!canWrite}
                           onChange={(e) => set({ aliases: e.target.value })}
                           placeholder="예: CFD, 전산유체" />
                  </Field>
                </Pair>

                <Field>
                  <span>한 줄로 무엇인가</span>
                  <input value={d.summary} disabled={!canWrite}
                         onChange={(e) => set({ summary: e.target.value })}
                         placeholder="예: 유체의 흐름과 열을 수치로 푼다" />
                </Field>

                <Field>
                  <span>우리한테 어디에 쓸 만한가</span>
                  <textarea value={d.description} disabled={!canWrite}
                            onChange={(e) => set({ description: e.target.value })} />
                </Field>

                <Pair>
                  <Field>
                    <span>태그 (쉼표로)</span>
                    <input value={d.tags} disabled={!canWrite}
                           onChange={(e) => set({ tags: e.target.value })} />
                  </Field>
                  {(cptGroups || []).length > 0 && (
                    <Field as="div">
                      <span>DTC 역량 분류</span>
                      <Chips>
                        {(cptGroups || []).map((g) => (
                          <CptBtn key={g.key} type="button" disabled={!canWrite}
                                  $on={d.cpt.includes(g.key)}
                                  title={g.label || ''}
                                  onClick={() => toggleCpt(g.key)}>
                            {g.key}
                          </CptBtn>
                        ))}
                      </Chips>
                    </Field>
                  )}
                </Pair>

                <Pair>
                  <Box>
                    <h4><Wrench size={12} /> 무엇으로 하나</h4>
                    <Chips>
                      {(kidsOf[current.uuid] || []).map((t) => (
                        <span key={t.uuid}>{t.name}</span>
                      ))}
                      {(kidsOf[current.uuid] || []).length === 0 && (
                        <i>매달린 도구가 없습니다 — 「도구 관리」에서 매답니다.</i>
                      )}
                    </Chips>
                  </Box>

                  {/*
                    ⚠️⚠️ **단계 칸이 아니라 「누가 적었나」다.** 역량에는 단계가 없다 —
                       단계는 사업부마다 답이 달라서 사업부 줄에만 산다. 여기 비어
                       있다는 것은 레이더에 점이 없다는 뜻이고, 그게 손댈 자리다.
                  */}
                  <Box>
                    <h4><Users size={12} /> 누가 어디까지 왔나</h4>
                    <Chips>
                      {(current.divisionMarks || []).map((m) => (
                        <Who key={m.division} $bg="#eef2ff" $color="#3730a3">
                          {m.division} {m.stage}
                        </Who>
                      ))}
                      {(current.divisionMarks || []).length === 0 && (
                        <i>
                          아직 아무 사업부도 안 적었습니다 — 레이더에 점이 없습니다.
                          「사업부 적기」에서 적습니다.
                        </i>
                      )}
                    </Chips>
                  </Box>
                </Pair>
              </>
            )}
          </Right>
        </Two>

        <Foot>
          {canCurate && current && (
            <Danger type="button" onClick={remove} disabled={busy === 'del'}>
              <Trash2 size={13} /> 지우기
            </Danger>
          )}
          {!canWrite && (
            <Note>읽기만 됩니다 — 고치려면 권한이 필요합니다.</Note>
          )}
          {canWrite && !changed && current && (
            <Note>고치면 저장할 수 있습니다</Note>
          )}
          <Ghost type="button" onClick={onClose} style={{ marginLeft: 'auto' }}>
            닫기
          </Ghost>
          {canWrite && current && (
            <Save type="button" onClick={save}
                  disabled={!changed || !d.name.trim() || busy === 'save'}>
              {busy === 'save' ? '담는 중…' : '저장'}
            </Save>
          )}
        </Foot>
      </Panel>
    </Overlay>
  );
};

export default CapabilityManagerModal;
