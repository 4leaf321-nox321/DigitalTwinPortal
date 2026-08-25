import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Loader2, AlertTriangle, Check } from 'lucide-react';

import api from '../services/api';
import { STAGES } from './RadarBoard';

/**
 * **우리 사업부 한 판에 적기.**
 *
 * 왜 만들었나
 *     역량 하나를 적으려면 레이더에서 점을 찾아 → 창을 열고 → 사업부 칸을 펴고 →
 *     고르고 → 저장하기를 **63번** 해야 했다. 아무도 안 했다 — 504칸 중
 *     24칸(4.8%)만 찼고, 비교표도 분야별 그림도 전부 거기서 막혔다. 새 그림을
 *     하나 더 그린다고 풀릴 일이 아니라 **적는 값이 싸져야** 풀린다.
 *
 * ⚠️⚠️ **가장 싼 입력을 앞에 둔다 — 「단계는 그대로, 도구만」.** 이유를 안 묻고,
 *    판단도 아니고, 사업부가 이미 아는 것이다. 단계 예외는 여전히 이유를 묻지만
 *    그건 드물게 하는 일이라 그래도 된다. 이 순서가 뒤집히면 이 화면은 있으나
 *    마나다.
 *
 * ⚠️ **분야 탭으로 자른다.** 63줄을 한 번에 세우면 스크롤만 하다 닫는다. 한
 *    분야는 열 줄 안팎이라 한 화면에 들어온다.
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
  width: min(88rem, 96vw);
  height: 88vh;
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

  h2 {
    margin: 0;
    font-size: 0.9375rem;
    color: #0f172a;
  }
  select {
    font-size: 0.8125rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
  }
  > button.x {
    margin-left: auto;
    border: none;
    background: none;
    cursor: pointer;
    color: #64748b;
    display: inline-flex;
  }
`;

/* 얼마나 찼나. ⚠️ 이 숫자가 이 화면을 여는 이유다 — 안 보이면 아무도 안 연다. */
const Fill = styled.span`
  font-size: 0.75rem;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;

  b { color: #4338ca; font-variant-numeric: tabular-nums; }
  i {
    font-style: normal;
    width: 6rem;
    height: 0.375rem;
    border-radius: 999px;
    background: #e2e8f0;
    overflow: hidden;
  }
  i > u {
    display: block;
    height: 100%;
    background: #6366f1;
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem 1rem 0;
  flex-wrap: wrap;
`;

const Tab = styled.button`
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#eef2ff' : '#fff')};
  color: ${(p) => (p.$on ? '#3730a3' : '#64748b')};
  font-weight: ${(p) => (p.$on ? 600 : 400)};
  font-size: 0.75rem;
  padding: 0.3125rem 0.625rem;
  border-radius: 999px;
  cursor: pointer;

  em {
    font-style: normal;
    opacity: 0.65;
    margin-left: 0.25rem;
    font-variant-numeric: tabular-nums;
  }
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem 1rem 1rem;
`;

const Row = styled.div`
  border: 1px solid ${(p) => (p.$dirty ? '#c7d2fe' : '#f1f5f9')};
  background: ${(p) => (p.$dirty ? '#f5f7ff' : '#fff')};
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  margin-bottom: 0.375rem;
`;

const Line = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;

  b.name {
    font-size: 0.8125rem;
    color: #0f172a;
  }
  q {
    quotes: none;
    flex: 1;
    min-width: 8rem;
    font-size: 0.6875rem;
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  select {
    font-size: 0.75rem;
    padding: 0.1875rem 0.375rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.3125rem;
  }
`;

const Base = styled.span`
  font-size: 0.6875rem;
  color: #64748b;
  flex-shrink: 0;

  b { color: ${(p) => p.$color}; }
`;

/* ⚠️ 도구가 **줄 안에 그대로** 보여야 한다. 눌러서 펴게 하면 63번 누르던 것이
   63번 펴는 것으로 바뀔 뿐이다. */
const Tools = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.375rem;
  padding-left: 0.125rem;
`;

const Chip = styled.button`
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#eef2ff' : '#fff')};
  color: ${(p) => (p.$on ? '#3730a3' : '#64748b')};
  font-weight: ${(p) => (p.$on ? 600 : 400)};
  font-size: 0.6875rem;
  padding: 0.125rem 0.4375rem;
  border-radius: 999px;
  cursor: pointer;
`;

const Bare = styled.small`
  font-size: 0.6875rem;
  color: #cbd5e1;
  margin-top: 0.25rem;
  display: block;
`;

const Why = styled.input`
  margin-top: 0.375rem;
  width: 100%;
  font-size: 0.75rem;
  padding: 0.25rem 0.4375rem;
  border: 1px solid ${(p) => (p.$need ? '#fca5a5' : '#e2e8f0')};
  border-radius: 0.3125rem;
`;

const Sector = styled.h3`
  margin: 0.875rem 0 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #6366f1;
  display: flex;
  align-items: center;
  gap: 0.375rem;

  span { flex: 1; height: 1px; background: #e0e7ff; }
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
  margin-left: auto;
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

const Msg = styled.p`
  margin: 0;
  padding: 2rem;
  text-align: center;
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const Failed = styled.ul`
  margin: 0 1rem 0.625rem;
  padding: 0.5rem 0.75rem;
  list-style: none;
  border: 1px solid #fecaca;
  background: #fef2f2;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #b91c1c;
  max-height: 7rem;
  overflow-y: auto;

  li { margin: 0.125rem 0; }
  li b { font-weight: 600; }
`;

const FOLLOW = '';
const ALL = '전체';

const stageOf = (key) => STAGES.find((s) => s.key === key) || STAGES[0];
const sameSet = (a, b) => a.length === b.length && a.every((u) => b.includes(u));

/** 서버가 준 줄을 「적을 것」 모양으로. */
const asDraft = (r) => ({
  stage: r.stage || FOLLOW,
  reason: r.reason || '',
  tools: r.tools || [],
});

const dirtyOf = (r, d) => !!d && (
  d.stage !== (r.stage || FOLLOW)
  || d.reason.trim() !== (r.reason || '').trim()
  || !sameSet(d.tools, r.tools || []));

/* 예외를 만들 때만 이유가 필요하다 — 「따름」은 주장이 아니다. 서버가 정본이다. */
const needWhy = (d) => !!d && d.stage !== FOLLOW && !d.reason.trim();

const DivisionSheet = ({ isOpen, divisions, initial = '', canCurate,
                         onClose, onSaved, showError, initialData = null }) => {
  const [division, setDivision] = useState(initial || (divisions || [])[0] || '');
  const [data, setData] = useState(initialData);
  const [failed, setFailed] = useState(null);
  const [sector, setSector] = useState(ALL);
  const [draft, setDraft] = useState({});      // uuid → 적을 것
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState([]);          // 저장에서 튕긴 줄

  /*
    ⚠️ **약속을 돌려준다.** 저장한 쪽이 「다 읽은 뒤에」 튕긴 줄을 보여줘야 하기
       때문이다. 안 그러면 여기서 `setBad([])` 가 늦게 도착해 방금 띄운 실패
       목록을 지워 버린다 — 사람은 무엇이 안 담겼는지 영영 못 본다.
  */
  const load = useCallback(() => {
    if (!isOpen || !division) return Promise.resolve();
    setData(null);
    setFailed(null);
    setBad([]);
    return api.divisionSheet(division)
      .then((d) => { setData(d); setDraft({}); })
      .catch((e) => setFailed(e.message || '불러오지 못했습니다.'));
  }, [isOpen, division]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (data?.rows || []), [data]);
  const byUuid = useMemo(() => {
    const m = {};
    rows.forEach((r) => { m[r.uuid] = r; });
    return m;
  }, [rows]);

  // 바뀐 줄만 추린다. ⚠️ 열어만 보고 닫은 줄은 안 보낸다.
  const changed = useMemo(() => Object.keys(draft)
    .filter((u) => byUuid[u] && dirtyOf(byUuid[u], draft[u])), [draft, byUuid]);
  const blocked = changed.filter((u) => needWhy(draft[u]));

  if (!isOpen) return null;

  const set = (uuid, patch) => setDraft((p) => ({
    ...p,
    [uuid]: { ...(p[uuid] || asDraft(byUuid[uuid])), ...patch },
  }));

  const toggleTool = (uuid, t) => {
    const cur = (draft[uuid] || asDraft(byUuid[uuid])).tools;
    set(uuid, { tools: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await api.saveDivisionSheet(division, changed.map((u) => ({
        uuid: u,
        stage: draft[u].stage || null,
        reason: draft[u].reason.trim(),
        tools: draft[u].tools,
      })));
      await load();                       // ⚠️ 먼저 다 읽고,
      setBad(res?.failed || []);          //    그다음에 튕긴 줄을 띄운다.
      if (onSaved) onSaved(res?.saved || 0);
    } catch (e) {
      showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const shown = sector === ALL ? rows : rows.filter((r) => r.category === sector);
  const sectors = data?.sectors || [];
  const filled = data ? data.filled : 0;
  const total = data ? data.total : 0;

  // 분야 안에서 다시 분야 머리를 세우면 겹친다 — 「전체」일 때만 묶어 보인다.
  let last = null;

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Head>
          <h2>우리 사업부 한 판에 적기</h2>
          <select value={division} onChange={(e) => setDivision(e.target.value)}>
            {(divisions || []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {data && (
            <Fill title="이 사업부가 무엇이라도 적어 둔 역량의 수">
              <b>{filled}</b> / {total} 적음
              <i><u style={{ width: `${total ? (filled / total) * 100 : 0}%` }} /></i>
            </Fill>
          )}
          <button type="button" className="x" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </Head>

        {data && sectors.length > 1 && (
          <Tabs>
            <Tab type="button" $on={sector === ALL} onClick={() => setSector(ALL)}>
              {ALL}<em>{rows.length}</em>
            </Tab>
            {sectors.map((g) => (
              <Tab key={g} type="button" $on={sector === g}
                   onClick={() => setSector(g)}>
                {g}<em>{rows.filter((r) => r.category === g).length}</em>
              </Tab>
            ))}
          </Tabs>
        )}

        {bad.length > 0 && (
          <Failed>
            {/* ⚠️ 나머지는 담겼다는 말을 함께 해야 한다 — 안 그러면 전부 날아간
                줄 알고 처음부터 다시 적는다. */}
            <li><b>아래 {bad.length}줄만 안 담겼습니다.</b> 나머지는 담겼습니다.</li>
            {bad.map((b, i) => (
              <li key={i}>· <b>{b.name}</b> — {b.error}</li>
            ))}
          </Failed>
        )}

        <Body>
          {!data && <Msg>{failed ? `불러오지 못했습니다 — ${failed}` : '불러오는 중…'}</Msg>}
          {data && shown.length === 0 && <Msg>이 분야에는 역량이 없습니다.</Msg>}

          {data && shown.map((r) => {
            const d = draft[r.uuid] || asDraft(r);
            const dirty = dirtyOf(r, draft[r.uuid]);
            const st = stageOf(r.companyStage);
            const head = sector === ALL && r.category !== last
              ? (last = r.category) : null;
            return (
              <React.Fragment key={r.uuid}>
                {head && <Sector>{head}<span /></Sector>}
                <Row $dirty={dirty}>
                  <Line>
                    <b className="name">{r.name}</b>
                    <Base $color={st.color}>
                      기본 설정 <b>{r.companyStage}</b>
                    </Base>
                    <select value={d.stage} disabled={!canCurate}
                            title={canCurate ? '' : '적는 것은 관리자ㆍ사무국만 할 수 있습니다'}
                            onChange={(e) => set(r.uuid, { stage: e.target.value })}>
                      {/*
                        ⚠️ 기본 설정과 **같은 값은 고를 거리가 아니다** — 그것이
                           곧 「따름」이고, 굳이 붙박아 두면 기본 설정이 움직였을
                           때 이 사업부만 옛 값에 남는다.
                      */}
                      <option value={FOLLOW}>우리도 그대로 ({r.companyStage})</option>
                      {STAGES.filter((s) => s.key !== r.companyStage).map((s) => (
                        <option key={s.key} value={s.key}>{s.key}</option>
                      ))}
                    </select>
                    <q>{r.summary || ''}</q>
                  </Line>

                  {r.toolChoices.length > 0 ? (
                    <Tools>
                      {r.toolChoices.map((c) => (
                        <Chip key={c.uuid} type="button" $on={d.tools.includes(c.uuid)}
                              disabled={!canCurate}
                              title={c.vendor || ''}
                              onClick={() => toggleTool(r.uuid, c.uuid)}>
                          {c.name}
                        </Chip>
                      ))}
                    </Tools>
                  ) : (
                    <Bare>
                      매달린 도구가 없습니다 — 「도구 관리」에서 넣으면 여기서
                      고를 수 있게 됩니다.
                    </Bare>
                  )}

                  {/* 이유는 예외를 만들 때만 묻는다. 「따름」은 주장이 아니다. */}
                  {canCurate && d.stage !== FOLLOW && (
                    <Why value={d.reason} $need={needWhy(d)}
                         onChange={(e) => set(r.uuid, { reason: e.target.value })}
                         placeholder={`기본 설정과 다르게 「${d.stage}」 로 보는 이유 — 예: 차체 충돌 해석이 본업이라 3년째 상시 사용`} />
                  )}
                </Row>
              </React.Fragment>
            );
          })}
        </Body>

        <Foot>
          {!canCurate && (
            <Note>
              읽기만 됩니다 — 적는 것은 <b>관리자ㆍ사무국</b>입니다. 단계는 개인
              의견이 아니라 조직이 어디까지 왔는지의 표기라서입니다.
            </Note>
          )}
          {canCurate && blocked.length > 0 && (
            <Note style={{ color: '#b91c1c', display: 'inline-flex', gap: '0.25rem' }}>
              <AlertTriangle size={13} />
              기본 설정과 다르게 본 <b>{blocked.length}줄</b>에 이유가 비어 있습니다
            </Note>
          )}
          {canCurate && blocked.length === 0 && (
            <Note>
              {changed.length === 0
                ? '단계를 고르거나 도구를 누르면 저장할 수 있습니다'
                : <><b>{changed.length}줄</b> 바뀌었습니다</>}
            </Note>
          )}
          <Ghost type="button" onClick={onClose} style={{ marginLeft: 'auto' }}>
            닫기
          </Ghost>
          {canCurate && (
            <Save type="button" style={{ marginLeft: 0 }} onClick={save}
                  disabled={busy || !changed.length || blocked.length > 0}>
              {busy ? <><Loader2 size={13} /> 담는 중…</>
                    : <><Check size={13} /> {changed.length || ''} 줄 저장</>}
            </Save>
          )}
        </Foot>
      </Panel>
    </Overlay>
  );
};

export default DivisionSheet;
