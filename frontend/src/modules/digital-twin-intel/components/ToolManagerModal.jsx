import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  X, Wrench, Plus, Search, Loader2, Unlink, Trash2, AlertTriangle, CornerDownRight,
  Layers,
} from 'lucide-react';

import api from '../services/api';
import { Overlay, Panel, Head, CloseBtn, Body, Foot, Hint, GhostBtn } from './modalStyles';
import CapabilityPicker from './CapabilityPicker';

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
 * ⚠️⚠️ **한 도구가 여러 역량에 걸린다.** 자료로 세어 보니 546개 중 58개(11%)가
 *    그랬다 — MATLAB/Simulink 는 1D 시스템ㆍ제어 검증ㆍ대리모델에 함께 걸린다.
 *    그래서 왼쪽에서 어느 역량을 보든 **같은 도구가 여러 곳에 나온다.** 맞는 그림이다.
 */
/** 분야를 안 가리고 다 본다. ⚠️ 분야 이름과 겹치지 않는 값이어야 한다. */
const ALL_SECTORS = '전체';

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

/*
  ⚠️⚠️ **분야를 골라 그 분야만 본다**(2026-08-26 요청). 63개를 한 줄로 죽 세우면
     분야 머리글이 있어도 찾기가 더 어렵다 — 스크롤로 지나쳐 버린다. 드롭다운이
     아니라 **토글**인 이유는, 지금 어느 분야를 보고 있는지와 **다른 분야가 무엇이
     있는지**가 함께 보여야 하기 때문이다. 드롭다운은 둘 다 감춘다.
*/
const LeftCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-height: 0;
`;

const Tabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.1875rem;
  flex-shrink: 0;
`;

const Tab = styled.button`
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#eef2ff' : '#fff')};
  color: ${(p) => (p.$on ? '#3730a3' : '#64748b')};
  font-weight: ${(p) => (p.$on ? 600 : 400)};
  font-size: 0.6875rem;
  padding: 0.1875rem 0.4375rem;
  border-radius: 999px;
  cursor: pointer;

  em {
    font-style: normal;
    opacity: 0.6;
    margin-left: 0.1875rem;
    font-variant-numeric: tabular-nums;
  }
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

/* ⚠️ 역량 39개를 한 줄로 늘어놓으면 눈이 미끄러진다. 분야로 묶어 **범위를 줄인다.** */
const SectorHead = styled.h4`
  margin: 0.375rem 0 0.125rem;
  font-size: 0.625rem;
  font-weight: 700;
  color: #6366f1;
  letter-spacing: 0.02em;
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

  /* ⚠️ **이름은 안 자른다.** 「제어 설계ㆍ검증 (MIL/SIL/HIL)」처럼 긴 이름이
     잘리면 옆 것과 구별이 안 된다. 줄을 접는다. */
  b { flex: 1; min-width: 0; white-space: normal; word-break: keep-all;
      line-height: 1.4; font-weight: inherit; }
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

const MoveBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  border-radius: 0.3125rem;
  padding: 0.25rem 0.4375rem;
  font-size: 0.6875rem;
  cursor: pointer;

  &:hover { border-color: #a5b4fc; color: #4f46e5; }
  &:disabled { opacity: 0.4; cursor: default; }
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

const ToolManagerModal = ({ isOpen, tech, categories, canWrite, canCurate,
                            onClose, onChanged, showError }) => {
  const [pick, setPick] = useState(null);
  // 옮길 도구. null 이면 고르기 창이 안 떠 있다.
  const [moving, setMoving] = useState(null);
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  // ⚠️ null 은 「아직 안 골랐다」 — 처음 열면 **첫 분야**를 편다(전체를 펴면 안 고친 것과 같다).
  const [sector, setSector] = useState(null);
  const [vendor, setVendor] = useState('');
  const [busy, setBusy] = useState('');

  const caps = useMemo(
    () => (tech || []).filter((t) => t.kind === 'capability'), [tech]);
  const tools = useMemo(
    () => (tech || []).filter((t) => t.kind !== 'capability'), [tech]);
  const orphans = useMemo(
    () => tools.filter((t) => !(t.capabilityUuids || []).length), [tools]);

  /*
    왼쪽 목록을 **분야(부채꼴)로 묶는다.** 차례는 설정을 따르되 설정에 없는 분야도
    뒤에 붙인다 — 안 붙이면 그 역량이 통째로 안 보이고 「왜 안 나오지」가 된다.
  */
  const sectors = useMemo(() => {
    const by = new Map();
    caps.forEach((c) => {
      const g = c.category || '분류 없음';
      if (!by.has(g)) by.set(g, []);
      by.get(g).push(c);
    });
    const ordered = (categories || []).filter((g) => by.has(g));
    [...by.keys()].forEach((g) => { if (!ordered.includes(g)) ordered.push(g); });
    return ordered.map((g) => [g, by.get(g)]);
  }, [caps, categories]);

  if (!isOpen) return null;

  /*
    ⚠️ 고른 분야는 **목록만** 줄인다 — 오른쪽에 열어 둔 역량은 그대로 둔다. 분야를
       바꿀 때마다 고른 것이 튀면 「어디 갔지」가 된다.
  */
  const curSector = sector === null
    ? (sectors[0] ? sectors[0][0] : ALL_SECTORS) : sector;
  const shownSectors = curSector === ALL_SECTORS
    ? sectors : sectors.filter(([g]) => g === curSector);

  const current = pick || (caps[0] ? caps[0].uuid : ORPHAN);
  const showing = current === ORPHAN
    ? orphans
    : tools.filter((t) => (t.capabilityUuids || []).includes(current));
  const key = q.trim().toLowerCase();
  const rows = key
    ? showing.filter((t) => `${t.name} ${t.vendor || ''}`.toLowerCase().includes(key))
    : showing;
  const currentCap = caps.find((c) => c.uuid === current);

  /** ⚠️ `fn` 이 글월을 돌려주면 그걸 쓴다 — **무슨 일이 났는지는 해 봐야 안다.** */
  const run = async (id, fn, msg) => {
    setBusy(id);
    try {
      const said = await fn();
      await onChanged(said || msg);
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
      /*
        ⚠️⚠️ **이미 있는 이름이면 서버가 있던 줄을 돌려준다**(새로 안 만든다).
           예전에는 그때 매다는 일까지 건너뛰어서 **아무 일도 안 일어나는데
           「넣었습니다」**라고 했다(2026-08-26 신고). 이제 서버가 매달아 주고,
           여기서는 **무슨 일이 일어났는지 그대로** 말한다 — 「넣었다」와 「이미
           있던 것을 여기에도 매달았다」는 다른 일이다.
      */
      const made = await api.createTech({
        name: n,
        vendor: vendor.trim() || undefined,
        kind: 'tool',
        capabilityUuids: current === ORPHAN ? [] : [current],
      });
      setName('');
      setVendor('');
      return made && made.created === false
        ? `이미 있던 「${n}」 을 여기에도 매달았습니다.`
        : `「${n}」 을 넣었습니다.`;
    }, null);
  };

  // ⚠️ 「옮기기」가 아니라 **속한 역량들을 정하는 것**이 됐다.
  const setCaps = (t, list, msg) => run(t.uuid,
    () => api.setTechCapabilities(t.uuid, list), msg);

  const detach = (t) => {
    /*
      ⚠️⚠️ **지금 보고 있는 역량에서만 뗀다.** 여러 역량에 걸쳐 있으면 나머지는
         그대로 남는다 — 한 번에 다 떼면 「여기서 빼려던 것」이 딴 데까지 지운다.
      ⚠️ 떼면 그 역량의 「무엇으로 하나」에서도 빠진다(서버가 지운다). 적어 둔
         사업부가 있으면 그 말이 사라지는 것이므로 먼저 묻는다.
    */
    const rest = (t.capabilityUuids || []).filter((u) => u !== current);
    if (!window.confirm(
      `「${t.name}」 을 「${currentCap ? currentCap.name : '이 역량'}」 에서 떼어 냅니다.\n\n`
      + '이 역량의 사업부 표에 「무엇으로 하나」로 적혀 있었다면 거기서도 빠집니다.\n'
      + (rest.length
        ? `다른 역량 ${rest.length}곳에는 그대로 남습니다.`
        : '어느 역량에도 안 남아 레이더에 혼자 서게 되고, 어느 사업부 표에서도 고를 수 없습니다.'))) return;
    setCaps(t, rest, `「${t.name}」 을 떼어 냈습니다.`);
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
            <LeftCol>
              {sectors.length > 1 && (
                <Tabs>
                  <Tab type="button" $on={curSector === ALL_SECTORS}
                       onClick={() => setSector(ALL_SECTORS)}>
                    {ALL_SECTORS}<em>{caps.length}</em>
                  </Tab>
                  {sectors.map(([g, rows]) => (
                    <Tab key={g} type="button" $on={curSector === g}
                         onClick={() => setSector(g)}>
                      {g}<em>{rows.length}</em>
                    </Tab>
                  ))}
                </Tabs>
              )}

              <Left>
              {shownSectors.map(([g, rows]) => (
                <React.Fragment key={g}>
                  {/* ⚠️ 한 분야만 볼 때는 머리글이 겹말이다 — 탭이 이미 말했다. */}
                  {curSector === ALL_SECTORS && <SectorHead>{g}</SectorHead>}
                  {rows.map((c) => {
                    const n = tools.filter(
                      (t) => (t.capabilityUuids || []).includes(c.uuid)).length;
                    return (
                      <CapBtn key={c.uuid} type="button" $on={current === c.uuid}
                              onClick={() => { setPick(c.uuid); setQ(''); }}>
                        <b title={c.name}>{c.name}</b>
                        <em>{n}</em>
                      </CapBtn>
                    );
                  })}
                </React.Fragment>
              ))}

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
            </LeftCol>

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
                      {/* ⚠️ 도구에는 단계가 없다 — 자리는 **누가 쓴다고 적었나**다. */}
                      {(t.divisionMarks || []).length
                        ? t.divisionMarks.map((m) => `${m.division} ${m.stage}`).join(' · ')
                        : '아직 아무 사업부도 안 적음'}
                      {' · 근거 '}{t.evidenceCount ?? 0}건
                      {t.summary ? ` · ${t.summary}` : ''}
                    </small>

                    {busy === t.uuid && <Loader2 size={12} />}

                    {/*
                      옮기기. ⚠️ 한 도구는 역량 하나에만 매달린다.
                      ⚠️⚠️ 여기도 드롭다운이었다 — 좁은 줄 안에 역량 수십 개를
                         욱여넣으면 **고를 수가 없다.** 기술 추가 창과 같은
                         고르기 창을 띄운다(분야로 묶여 나온다).
                    */}
                    {canWrite && (
                      <MoveBtn type="button" disabled={busy === t.uuid}
                               onClick={() => setMoving(t)}
                               title="이 도구가 속한 역량들을 고칩니다">
                        <Layers size={11} /> 역량 {(t.capabilityUuids || []).length}
                      </MoveBtn>
                    )}

                    {canWrite && current !== ORPHAN && (
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

        {/*
          ⚠️ Panel 안에 둔다 — 바깥 Overlay 로 클릭이 새면 관리 창이 통째로 닫힌다.

          ⚠️⚠️ **열 때마다 새로 만든다**(2026-08-26 신고). 고르기 창은 지금 골라 둔
             것을 `useState` 초기값으로 **한 번만** 잡는다. 늘 트리에 남겨 두면 그
             한 번이 `moving === null` 인 순간이라, 창은 **아무것도 안 골라진 채로**
             뜨고 「다 골랐습니다」를 누르면 걸려 있던 역량이 통째로 떨어져 나갔다
             (그 도구는 미아가 되고, 사업부들이 적어 둔 「무엇으로 하나」에서도
             지워진다). 두 번째부터는 **앞 도구에서 고른 것**이 남아 엉뚱한 역량으로
             덮어썼다.
        */}
        {moving && (
        <CapabilityPicker
          key={moving.uuid}
          isOpen
          capabilities={caps}
          categories={categories}
          multi
          values={moving?.capabilityUuids || []}
          title={moving ? `「${moving.name}」 은 어느 역량에 속하나` : ''}
          noneLabel="어디에도 안 매달림 — 사업부 표에서 안 보이게 됩니다"
          onDone={(list) => {
            const t = moving;
            setMoving(null);
            setCaps(t, list, `「${t.name}」 의 역량을 ${list.length}곳으로 정했습니다.`);
          }}
          onClose={() => setMoving(null)} />
        )}

        <Foot>
          <GhostBtn type="button" onClick={onClose}>닫기</GhostBtn>
        </Foot>
      </Wide>
    </Overlay>
  );
};

export default ToolManagerModal;
