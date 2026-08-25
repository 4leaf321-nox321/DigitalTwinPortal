import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  X, Wrench, Plus, Search, Loader2, Unlink, Trash2, AlertTriangle, CornerDownRight,
} from 'lucide-react';

import api from '../services/api';
import { Overlay, Panel, Head, CloseBtn, Body, Foot, Hint, GhostBtn } from './modalStyles';

/**
 * **도구 관리** — 역량마다 「무엇으로 하나」에서 고를 수 있는 S/W 목록을 정의한다.
 *
 * ⚠️⚠️ **도구는 따로 저장되는 곳이 없다.** 역량과 같은 표(`dt_intel_tech`)에 있고,
 *    `kind='tool'` 과 `parent_uuid` 두 칸이 다를 뿐이다. 그래서 이 화면이 하는 일은
 *    새 표를 만드는 것이 아니라 **어느 역량 밑에 매다느냐를 정하는 것**이다.
 *
 * ⚠️⚠️ **매달려야 고를 수 있다.** 사업부가 「무엇으로 하나」에서 고를 수 있는 것은
 *    그 역량의 자식뿐이다(서버가 그렇게만 받는다 — 아무거나 받으면 「explicit
 *    해석을 Grafana 로 한다」가 조용히 생긴다). 안 매달린 도구는 레이더에는 혼자
 *    서지만 **어느 사업부 표에도 안 나온다** — 그래서 이 화면이 필요하다.
 *
 * ⚠️ **한 도구는 역량 하나에만 매달린다**(`parent_uuid` 가 한 칸이다). 같은 S/W 를
 *    두 역량에서 쓰면 지금은 각 역량 밑에 한 줄씩 두어야 한다. 짝 표로 바꾸면
 *    한 도구의 소식이 여러 역량으로 중복 셈되는 문제부터 정해야 해서 미뤄 뒀다.
 */
const ORPHAN = '__orphan__';

/*
  ⚠️⚠️ **`width` 만 덮어쓰면 안 된다.** `Panel` 은 `max-width` 로 폭을 잡는데,
     여기서 `width: min(58rem, 94vw)` 만 주고 있었다. `max-width` 가 기본값
     38rem 그대로라 **실제로는 38rem 이었다** — 왼쪽 15rem + 오른쪽이 그 안에
     욱여넣어져 있었다(2026-08-25 신고: 「폭을 좀 더 넓게」).
     `Panel` 이 쓰는 길(`$wide`)을 그대로 쓴다.

  두 칸짜리 관리 화면이라 다른 창보다 넓게 잡는다. 좁은 화면에서는 `vw` 가 이긴다.
*/
const Wide = styled(Panel)`
  max-width: min(76rem, 96vw);
`;

const Split = styled.div`
  display: grid;
  /* ⚠️ 역량 이름이 길다(「이산사건 공정 시뮬레이션」) — 좁으면 전부 …로 잘린다. */
  grid-template-columns: 18rem minmax(0, 1fr);
  gap: 0.75rem;
  min-height: 0;

  @media (max-width: 800px) { grid-template-columns: 1fr; }
`;

const Left = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  /* 창이 커진 만큼 목록도 길게. ⚠️ 화면이 낮으면 vh 가 이긴다. */
  max-height: min(32rem, 56vh);
  overflow-y: auto;
  padding-right: 0.25rem;
`;

const CapBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  text-align: left;
  padding: 0.375rem 0.5rem;
  border-radius: 0.4375rem;
  cursor: pointer;
  font-size: 0.75rem;
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : 'transparent')};
  background: ${(p) => (p.$on ? '#eef2ff' : 'transparent')};
  color: ${(p) => (p.$on ? '#3730a3' : '#334155')};
  font-weight: ${(p) => (p.$on ? 600 : 400)};

  &:hover { background: #f8fafc; }

  b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; font-weight: inherit; }
  em { font-style: normal; font-size: 0.6875rem; color: #94a3b8;
       font-variant-numeric: tabular-nums; }
`;

/* ⚠️ 안 매달린 도구 칸은 **셈이 0이어도 보인다** — 여기 쌓이는 것이 곧 할 일이라,
   0일 때만 안 보이면 「할 일이 있다」는 신호가 사라진다. */
const Orphan = styled(CapBtn)`
  border-top: 1px dashed #e2e8f0;
  border-radius: 0;
  margin-top: 0.25rem;
  padding-top: 0.5rem;
  color: ${(p) => (p.$warn ? '#b45309' : '#64748b')};
`;

const Right = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  max-height: min(32rem, 56vh);
`;

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;

  input {
    flex: 1;
    min-width: 0;
    font-size: 0.75rem;
    padding: 0.375rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
  }
`;

const AddRow = styled.div`
  display: flex;
  gap: 0.375rem;
  padding: 0.5rem;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;

  input {
    font-size: 0.75rem;
    padding: 0.375rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    min-width: 0;
  }
  input:first-child { flex: 2; }
  input:nth-child(2) { flex: 1; }
`;

const AddBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  border: none;
  background: #4f46e5;
  color: #fff;
  border-radius: 0.375rem;
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  cursor: pointer;

  &:disabled { background: #c7d2fe; cursor: not-allowed; }
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  min-height: 0;
`;

const Item = styled.li`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.4375rem;
  background: #fff;

  > b { font-size: 0.8125rem; color: #0f172a; flex-shrink: 0; }
  > small { flex: 1; min-width: 0; font-size: 0.6875rem; color: #64748b;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  select {
    flex-shrink: 0;
    max-width: 14rem;
    font-size: 0.6875rem;
    padding: 0.25rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.3125rem;
    background: #fff;
    color: #475569;
  }
`;

const Mini = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: ${(p) => (p.$danger ? '#b91c1c' : '#64748b')};
  border-radius: 0.3125rem;
  padding: 0.25rem;
  cursor: pointer;

  &:hover { border-color: ${(p) => (p.$danger ? '#fca5a5' : '#a5b4fc')}; }
`;

const Empty = styled.p`
  margin: 0;
  padding: 1rem 0.5rem;
  font-size: 0.75rem;
  color: #94a3b8;
  text-align: center;
`;

const ToolManagerModal = ({ isOpen, tech, canWrite, canCurate,
                            onClose, onChanged, showError }) => {
  const [pick, setPick] = useState(null);
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [busy, setBusy] = useState('');

  const caps = useMemo(
    () => (tech || []).filter((t) => t.kind === 'capability'), [tech]);
  const tools = useMemo(
    () => (tech || []).filter((t) => t.kind !== 'capability'), [tech]);
  const orphans = useMemo(() => tools.filter((t) => !t.parentUuid), [tools]);

  if (!isOpen) return null;

  const current = pick || (caps[0] ? caps[0].uuid : ORPHAN);
  const showing = current === ORPHAN
    ? orphans
    : tools.filter((t) => t.parentUuid === current);
  const key = q.trim().toLowerCase();
  const rows = key
    ? showing.filter((t) => `${t.name} ${t.vendor || ''}`.toLowerCase().includes(key))
    : showing;
  const currentCap = caps.find((c) => c.uuid === current);

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

  const add = () => {
    const n = name.trim();
    if (!n) return;
    run('add', async () => {
      /*
        ⚠️ **고른 역량 밑으로 바로 매단다.** 만들고 나서 따로 매달게 하면 그 두 번째
           걸음을 안 밟고, 미아만 쌓인다 — 미아는 어느 사업부 표에도 안 나온다.
      */
      await api.createTech({
        name: n,
        vendor: vendor.trim() || undefined,
        kind: 'tool',
        parentUuid: current === ORPHAN ? '' : current,
      });
      setName('');
      setVendor('');
    }, `「${n}」 을 넣었습니다.`);
  };

  const move = (t, parentUuid) => run(t.uuid,
    () => api.setTechParent(t.uuid, parentUuid === ORPHAN ? '' : parentUuid),
    parentUuid === ORPHAN
      ? `「${t.name}」 을 떼어 냈습니다. 사업부 표에서는 이제 안 보입니다.`
      : `「${t.name}」 을 옮겼습니다.`);

  const detach = (t) => {
    /*
      ⚠️ **떼어 내면 그 역량의 「무엇으로 하나」에서도 빠진다**(서버가 지운다).
         적어 둔 사업부가 있으면 그 말이 사라지는 것이므로 먼저 묻는다.
    */
    if (!window.confirm(
      `「${t.name}」 을 「${currentCap ? currentCap.name : '이 역량'}」 에서 떼어 냅니다.\n\n`
      + '이 역량의 사업부 표에 「무엇으로 하나」로 적혀 있었다면 거기서도 빠집니다.\n'
      + '레이더에는 혼자 서지만, 어느 사업부 표에서도 고를 수 없게 됩니다.')) return;
    move(t, ORPHAN);
  };

  const remove = (t) => {
    if (!window.confirm(
      `「${t.name}」 을 아주 지웁니다. 되돌릴 수 없습니다.\n\n`
      + '이 도구에 걸린 근거 소식과, 사업부들이 적어 둔 「무엇으로 하나」에서도 함께 사라집니다.')) return;
    run(t.uuid, () => api.deleteTech(t.uuid), `「${t.name}」 을 지웠습니다.`);
  };

  return (
    <Overlay onClick={onClose}>
      <Wide onClick={(e) => e.stopPropagation()}>
        <Head>
          <Wrench size={17} color="#4f46e5" />
          <h2>도구 관리</h2>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Head>

        <Body>
          <Hint>
            사업부가 「무엇으로 하나」에서 고를 수 있는 것은 <b>그 역량에 매달린
            도구뿐</b>입니다. 왼쪽에서 역량을 고르고, 그 밑에 쓰는 S/W 를 넣으세요.
            <b> 안 매달린 도구는 레이더에는 서지만 어느 사업부 표에도 안 나옵니다.</b>
          </Hint>

          <Split>
            <Left>
              {caps.map((c) => {
                const n = tools.filter((t) => t.parentUuid === c.uuid).length;
                return (
                  <CapBtn key={c.uuid} type="button" $on={current === c.uuid}
                          onClick={() => { setPick(c.uuid); setQ(''); }}>
                    <b title={c.name}>{c.name}</b>
                    <em>{n}</em>
                  </CapBtn>
                );
              })}

              {/*
                ⚠️ **셈이 0이어도 보인다.** 여기 쌓이는 것이 곧 할 일이라, 0일 때만
                   숨기면 「할 일이 있다」는 신호 자체가 사라진다.
              */}
              <Orphan type="button" $on={current === ORPHAN}
                      $warn={orphans.length > 0}
                      onClick={() => { setPick(ORPHAN); setQ(''); }}>
                {orphans.length > 0 && <AlertTriangle size={11} />}
                <b>아직 안 매단 도구</b>
                <em>{orphans.length}</em>
              </Orphan>
            </Left>

            <Right>
              <Bar>
                <Search size={13} color="#94a3b8" />
                <input value={q} onChange={(e) => setQ(e.target.value)}
                       placeholder="이 역량 안에서 이름·공급사로 찾기" />
              </Bar>

              {canWrite && (
                <AddRow>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                         onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                         placeholder={current === ORPHAN
                           ? '도구 이름 (역량은 나중에 고릅니다)'
                           : `「${currentCap ? currentCap.name : ''}」 에 넣을 도구 이름`} />
                  <input value={vendor} onChange={(e) => setVendor(e.target.value)}
                         placeholder="공급사" />
                  <AddBtn type="button" disabled={!name.trim() || busy === 'add'}
                          onClick={add}>
                    {busy === 'add' ? <Loader2 size={13} /> : <Plus size={13} />} 넣기
                  </AddBtn>
                </AddRow>
              )}

              <List>
                {rows.length === 0 && (
                  <Empty>
                    {key
                      ? '찾는 도구가 없습니다.'
                      : current === ORPHAN
                        ? '안 매단 도구가 없습니다. 전부 어느 역량엔가 들어 있습니다.'
                        : '이 역량에 매달린 도구가 없습니다. 위에서 넣어 주세요 — 없으면 사업부가 「무엇으로 하나」를 못 고릅니다.'}
                  </Empty>
                )}

                {rows.map((t) => (
                  <Item key={t.uuid}>
                    <b>{t.name}</b>
                    <small>
                      {t.vendor ? `${t.vendor} · ` : ''}
                      {t.stage} · 근거 {t.evidenceCount ?? 0}건
                      {t.summary ? ` · ${t.summary}` : ''}
                    </small>

                    {busy === t.uuid && <Loader2 size={12} />}

                    {/* 옮기기. ⚠️ 한 도구는 역량 하나에만 매달린다. */}
                    {canWrite && (
                      <select value={t.parentUuid || ORPHAN}
                              disabled={busy === t.uuid}
                              title="다른 역량으로 옮깁니다"
                              onChange={(e) => move(t, e.target.value)}>
                        <option value={ORPHAN}>— 안 매달림 —</option>
                        {caps.map((c) => (
                          <option key={c.uuid} value={c.uuid}>{c.name}</option>
                        ))}
                      </select>
                    )}

                    {canWrite && t.parentUuid && (
                      <Mini type="button" onClick={() => detach(t)}
                            title="이 역량에서 떼어 냅니다">
                        <Unlink size={12} />
                      </Mini>
                    )}

                    {canCurate && (
                      <Mini type="button" $danger onClick={() => remove(t)}
                            title="아주 지웁니다 (근거도 함께 사라집니다)">
                        <Trash2 size={12} />
                      </Mini>
                    )}
                  </Item>
                ))}
              </List>

              {current === ORPHAN && orphans.length > 0 && (
                <Hint>
                  <CornerDownRight size={11} /> 위 목록에서 <b>역량을 골라 주면</b>
                  {' '}그 역량의 사업부 표에서 고를 수 있게 됩니다.
                </Hint>
              )}
            </Right>
          </Split>
        </Body>

        <Foot>
          <GhostBtn type="button" onClick={onClose}>닫기</GhostBtn>
        </Foot>
      </Wide>
    </Overlay>
  );
};

export default ToolManagerModal;
