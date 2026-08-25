import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Search, Check, Layers } from 'lucide-react';

import {
  Overlay, Panel, Head, CloseBtn, Body, Foot, Hint, Spacer, GhostBtn, PrimaryBtn,
} from './modalStyles';

/**
 * **역량 고르기** — 분야(부채꼴)로 묶어서 보여준다.
 *
 * ⚠️⚠️ **드롭다운으로는 못 고른다.** 역량이 39개인데 한 줄로 늘어놓으면 「어떤 걸
 *    골라야 하지」가 되고, 그러면 사람은 아무거나 고르거나 그냥 안 고른다 —
 *    안 고른 도구는 미아가 되어 **어느 사업부 표에도 안 나온다**(2026-08-25 신고).
 *
 * ⚠️ 그래서 세 가지를 함께 보여준다. 이름만으로는 여전히 못 고른다.
 *        분야(부채꼴)로 묶기   — 「시뮬레이션·해석 안에서 고른다」로 범위가 줄어든다
 *        한 줄 요약           — 「이게 무슨 역량인지」
 *        이미 매달린 도구      — **가장 강한 힌트다.** 「LS-DYNA 가 여기 있네」
 *
 * ⚠️ 찾기는 **자식 도구 이름까지** 닿는다. 「RADIOSS 를 어디에 매달지」를 물을 때
 *    사람이 아는 것은 형제 도구 이름이지 역량 이름이 아니다.
 */
const UNCATEGORIZED = '분류 없음';

/* ⚠️ 기술 추가 창 **위에** 뜬다. 밑에 깔리면 눌러도 아무 일이 없는 것처럼 보인다. */
const Above = styled(Overlay)`
  z-index: 1100;
`;

const Box = styled(Panel)`
  max-width: min(74rem, 92vw);
  width: min(74rem, 92vw);
  height: 80vh;
  max-height: 80vh;

  @media (max-width: 900px) {
    width: 94vw;
    max-width: 94vw;
    height: 90vh;
    max-height: 90vh;
  }
`;

/* ⚠️ 찾기 칸과 탭은 **늘 보이고**, 목록만 구른다. 함께 굴리면 탭을 바꾸려고 매번
   위로 올라가야 한다. */
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-right: 0.25rem;
`;

/*
  분야 탭. ⚠️⚠️ 63개를 세로로 죽 늘어놓으면 **찾기 전에 지친다**(2026-08-25 신고).
  갈래를 먼저 고르면 스무 개 남짓으로 줄어든다.
*/
const Tabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding-bottom: 0.125rem;
  border-bottom: 1px solid #f1f5f9;
`;

const Tab = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3125rem 0.625rem;
  border-radius: 0.4375rem;
  font-size: 0.75rem;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : 'transparent')};
  background: ${(p) => (p.$on ? '#eef2ff' : 'transparent')};
  color: ${(p) => (p.$on ? '#3730a3' : '#475569')};
  font-weight: ${(p) => (p.$on ? 700 : 400)};

  &:hover:not(:disabled) { background: #f8fafc; }

  /* ⚠️ 찾는 말에 안 걸리는 갈래는 **흐리게 두되 없애지 않는다** — 탭이 사라지면
     화면이 들썩이고, 「원래 몇 갈래였지」를 잃는다. */
  &:disabled { opacity: 0.35; cursor: default; }

  em {
    font-style: normal;
    font-size: 0.6875rem;
    color: ${(p) => (p.$on ? '#4f46e5' : '#94a3b8')};
    font-variant-numeric: tabular-nums;
  }
`;

const Elsewhere = styled.p`
  margin: 0;
  padding: 1.25rem 0.5rem;
  text-align: center;
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.6;

  button {
    margin-top: 0.5rem;
    display: block;
    margin-left: auto;
    margin-right: auto;
    border: 1px solid #a5b4fc;
    background: #fff;
    color: #4338ca;
    border-radius: 0.375rem;
    padding: 0.3125rem 0.75rem;
    font-size: 0.75rem;
    cursor: pointer;
  }
`;

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.4375rem;

  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    font-size: 0.8125rem;
    color: #0f172a;
  }
`;

const Group = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  > h4 {
    margin: 0;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #6366f1;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    gap: 0.3125rem;
  }

  > h4 span {
    flex: 1;
    height: 1px;
    background: #e0e7ff;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.3125rem;

  @media (max-width: 1100px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 640px)  { grid-template-columns: 1fr; }
`;

const Pick = styled.button`
  text-align: left;
  padding: 0.4375rem 0.5625rem;
  border-radius: 0.4375rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#eef2ff' : '#fff')};

  &:hover { border-color: #a5b4fc; background: #f8fafc; }

  b {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: ${(p) => (p.$on ? '#3730a3' : '#0f172a')};
  }

  /* 한 줄 요약. ⚠️ 이름만 있으면 6개월 뒤 「이게 뭐였지」가 된다 — 고를 때도 같다. */
  q {
    font-size: 0.6875rem;
    color: #64748b;
    line-height: 1.45;
    quotes: none;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* 이미 매달린 도구 — **가장 강한 힌트다.** */
  /* ⚠️ 도구 이름은 안 자른다 — 「어디에 무엇이 들어 있나」가 고르는 근거다.
     다만 **몇 개까지만** 보여준다(그 아래 「외 N」). 목록을 줄이는 것과 이름을
     자르는 것은 다른 일이다. */
  em {
    font-style: normal;
    font-size: 0.6875rem;
    color: #4338ca;
    line-height: 1.4;
    word-break: keep-all;
  }
`;

const None = styled(Pick)`
  border-style: dashed;
  b { color: #64748b; }
`;

const Empty = styled.p`
  margin: 0;
  padding: 1.5rem 0.5rem;
  text-align: center;
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const ALL = '__all__';

/*
  `initialQuery` · `initialTab` 은 **화면에서는 안 쓴다.** 찾기 칸과 탭은 눌러야
  바뀌는 값이라 서버 렌더로는 그 상태에 못 닿는데, 이 창에서 가장 위험한 자리가
  바로 거기다 — **다른 갈래에 있는 것을 찾았을 때 빈 화면이 되면** 찾는 사람은
  「없다」고 읽고 그만둔다. 검사가 그 상태를 그려 볼 수 있게 낸 자리다.
*/
/*
  ⚠️⚠️ **여러 개 고를 수 있다**(`multi`). 한 도구가 여러 역량에 걸리기 때문이다 —
     자료로 세어 보니 546개 중 58개(11%)가 그랬다. 하나만 고르게 두면 나머지는
     적을 데가 없다.

  ⚠️ 여러 개 고를 때는 **누를 때마다 닫히지 않는다.** 닫히면 두 번째를 고르려고
     매번 다시 열어야 한다 — 그 자체로 「여러 개」를 안 쓰게 만든다.
*/
const CapabilityPicker = ({ isOpen, capabilities, categories, value,
                            allowNone = true, noneLabel, title, onPick, onClose,
                            multi = false, values = null, onDone,
                            initialQuery = '', initialTab = null }) => {
  const [q, setQ] = useState(initialQuery);
  /*
    고른 갈래. ⚠️ **지금 골라 둔 역량이 있으면 그 갈래로 연다** — 「바꾸기」로 열었을
       때 지금 자리가 안 보이면 무엇을 바꾸는 중인지 놓친다.
  */
  const [tab, setTab] = useState(() => {
    if (initialTab) return initialTab;
    const cur = (capabilities || []).find((c) => c.uuid === value);
    return cur ? (cur.category || UNCATEGORIZED) : ALL;
  });
  // 여러 개 고를 때의 고른 것. ⚠️ 창 안에서 쥐고 있다가 「다 골랐다」에서 한 번에 낸다.
  const [picked, setPicked] = useState(() => (values || []).slice());
  const on = (uuid) => (multi ? picked.includes(uuid) : value === uuid);
  const hit = (uuid) => {
    if (!multi) { onPick(uuid); return; }
    setPicked((p) => (p.includes(uuid) ? p.filter((x) => x !== uuid) : [...p, uuid]));
  };

  const groups = useMemo(() => {
    const key = q.trim().toLowerCase();
    const hit = (c) => !key || [
      c.name, c.summary, c.category,
      ...(c.children || []).map((k) => k.name),
    ].some((v) => (v || '').toLowerCase().includes(key));

    const rows = (capabilities || []).filter(hit);
    const by = new Map();
    rows.forEach((c) => {
      const g = c.category || UNCATEGORIZED;
      if (!by.has(g)) by.set(g, []);
      by.get(g).push(c);
    });
    /*
      ⚠️ 차례는 설정을 따르되, 설정에 없는 분야도 뒤에 붙인다.
      ⚠️⚠️ **찾는 말에 하나도 안 걸린 갈래도 탭에는 남긴다**(빈 목록으로). 탭이
         사라지면 화면이 들썩이고, 「원래 몇 갈래였지」를 잃는다. 그래서 갈래
         목록은 **거르기 전 전체**에서 만든다.
    */
    const every = new Set((capabilities || []).map((c) => c.category || UNCATEGORIZED));
    const ordered = (categories || []).filter((g) => every.has(g));
    [...every].forEach((g) => { if (!ordered.includes(g)) ordered.push(g); });
    return ordered.map((g) => [g, by.get(g) || []]);
  }, [capabilities, categories, q]);

  if (!isOpen) return null;

  const total = groups.reduce((n, [, rows]) => n + rows.length, 0);
  const shown = tab === ALL ? groups : groups.filter(([g]) => g === tab);
  const shownCount = shown.reduce((n, [, rows]) => n + rows.length, 0);
  /*
    ⚠️⚠️ **다른 갈래에 있는 것을 찾았을 때 빈 화면이 되면 안 된다.** 찾는 사람은
       「없다」고 읽고 그만둔다. 몇 개가 어디 있는지 말해 주고 한 번에 건너가게 한다.
  */
  const elsewhere = tab !== ALL && shownCount === 0 && total > 0;

  return (
    <Above onClick={onClose}>
      <Box onClick={(e) => e.stopPropagation()}>
        <Head>
          <Layers size={17} color="#4f46e5" />
          <h2>{title || '어느 역량에 속하나'}</h2>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Head>

        <Body>
          <Bar>
            <Search size={14} color="#94a3b8" />
            {/* 찾기 칸에 바로 커서. ⚠️ 이 창은 **찾아서 고르는** 창이라,
                한 번 더 눌러야 치기 시작하면 드롭다운과 다를 게 없다. */}
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="역량 이름·설명으로, 또는 이미 매달린 도구 이름으로" />
          </Bar>

          {/*
            ⚠️⚠️ 갈래를 **탭으로** 올린다. 63개를 세로로 죽 늘어놓으면 찾기 전에
               지친다 — 갈래를 먼저 고르면 스무 개 남짓으로 줄어든다.
            ⚠️ 셈은 **찾는 말을 걸러 낸 뒤**의 수다. 그래야 어느 갈래에 걸렸는지가
               탭만 보고 읽힌다.
          */}
          <Tabs>
            <Tab type="button" $on={tab === ALL} onClick={() => setTab(ALL)}>
              전체 <em>{total}</em>
            </Tab>
            {groups.map(([g, rows]) => (
              <Tab key={g} type="button" $on={tab === g}
                   disabled={rows.length === 0}
                   onClick={() => setTab(g)}>
                {g} <em>{rows.length}</em>
              </Tab>
            ))}
          </Tabs>

          <Scroll>
          {allowNone && (
            <None type="button" $on={multi ? picked.length === 0 : !value}
                  onClick={() => (multi ? setPicked([]) : onPick(''))}>
              <b>
                {(multi ? picked.length === 0 : !value) && <Check size={13} />}
                {noneLabel || '아직 안 정함'}
              </b>
              <q>
                레이더에 이 도구가 혼자 섭니다. 다만 <b>어느 사업부 표에서도 고를 수
                없습니다</b> — 사업부는 역량에 매달린 도구 중에서만 고릅니다.
              </q>
            </None>
          )}

          {(capabilities || []).length === 0 && (
            <Empty>
              아직 역량이 하나도 없습니다. 먼저 역량을 만들어 주세요 —
              「기술 추가」에서 <b>역량</b>을 골라 넣으면 됩니다.
            </Empty>
          )}

          {(capabilities || []).length > 0 && total === 0 && (
            <Empty>「{q.trim()}」 에 걸리는 역량이 없습니다.</Empty>
          )}

          {elsewhere && (
            <Elsewhere>
              「{q.trim()}」 는 <b>이 갈래에 없습니다.</b> 다른 갈래에 {total}개
              있습니다.
              <button type="button" onClick={() => setTab(ALL)}>전체에서 보기</button>
            </Elsewhere>
          )}

          {shown.map(([g, rows]) => (rows.length === 0 ? null : (
            <Group key={g}>
              {/* ⚠️ 한 갈래만 볼 때도 머리글은 둔다 — 무엇을 보고 있는지 잊는다. */}
              <h4>{g} <span /></h4>
              <Grid>
                {rows.map((c) => {
                  const kids = (c.children || []).map((k) => k.name);
                  return (
                    <Pick key={c.uuid} type="button" $on={on(c.uuid)}
                          onClick={() => hit(c.uuid)}>
                      <b>
                        {on(c.uuid) && <Check size={13} />}
                        {c.name}
                      </b>
                      {c.summary && <q>{c.summary}</q>}
                      {kids.length > 0 && (
                        <em title={kids.join(' · ')}>
                          {kids.slice(0, 3).join(' · ')}
                          {kids.length > 3 ? ` 외 ${kids.length - 3}` : ''}
                        </em>
                      )}
                    </Pick>
                  );
                })}
              </Grid>
            </Group>
          )))}
          </Scroll>

          <Hint>
            <b>이미 매달린 도구</b>가 함께 보입니다 — 비슷한 것이 어디 들어 있는지가
            가장 확실한 힌트입니다. 찾기는 그 도구 이름으로도 됩니다.
            {multi && ' 여러 역량에 걸치면 걸치는 대로 고르세요 — 한 도구가 여러 곳에 속할 수 있습니다.'}
          </Hint>
        </Body>

        {/*
          ⚠️ 여러 개 고를 때만 아래 단추가 있다. 하나만 고를 때는 누르는 순간
             정해지므로 「다 골랐다」가 군더더기가 된다.
        */}
        {multi && (
          <Foot>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {picked.length ? `${picked.length}개 골랐습니다` : '아직 안 골랐습니다 — 레이더에 혼자 섭니다'}
            </span>
            <Spacer />
            <GhostBtn type="button" onClick={onClose}>그만두기</GhostBtn>
            <PrimaryBtn type="button" onClick={() => onDone(picked)}>
              다 골랐습니다
            </PrimaryBtn>
          </Foot>
        )}
      </Box>
    </Above>
  );
};

export default CapabilityPicker;
