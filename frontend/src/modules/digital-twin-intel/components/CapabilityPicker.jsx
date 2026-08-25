import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Search, Check, Layers } from 'lucide-react';

import { Overlay, Panel, Head, CloseBtn, Body, Hint } from './modalStyles';

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
  max-width: min(46rem, 94vw);
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;

  @media (max-width: 640px) { grid-template-columns: 1fr; }
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
  em {
    font-style: normal;
    font-size: 0.6875rem;
    color: #4338ca;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

const CapabilityPicker = ({ isOpen, capabilities, categories, value,
                            allowNone = true, noneLabel, title, onPick, onClose }) => {
  const [q, setQ] = useState('');

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
    // ⚠️ 차례는 설정을 따르되, 설정에 없는 분야도 뒤에 붙인다 — 안 붙이면 그 역량이
    //    통째로 안 보이고, 「왜 안 나오지」가 된다.
    const ordered = (categories || []).filter((g) => by.has(g));
    [...by.keys()].forEach((g) => { if (!ordered.includes(g)) ordered.push(g); });
    return ordered.map((g) => [g, by.get(g)]);
  }, [capabilities, categories, q]);

  if (!isOpen) return null;

  const total = groups.reduce((n, [, rows]) => n + rows.length, 0);

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

          {allowNone && (
            <None type="button" $on={!value} onClick={() => onPick('')}>
              <b>
                {!value && <Check size={13} />}
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

          {groups.map(([g, rows]) => (
            <Group key={g}>
              <h4>{g} <span /></h4>
              <Grid>
                {rows.map((c) => {
                  const kids = (c.children || []).map((k) => k.name);
                  return (
                    <Pick key={c.uuid} type="button" $on={value === c.uuid}
                          onClick={() => onPick(c.uuid)}>
                      <b>
                        {value === c.uuid && <Check size={13} />}
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
          ))}

          <Hint>
            <b>이미 매달린 도구</b>가 함께 보입니다 — 비슷한 것이 어디 들어 있는지가
            가장 확실한 힌트입니다. 찾기는 그 도구 이름으로도 됩니다.
          </Hint>
        </Body>
      </Box>
    </Above>
  );
};

export default CapabilityPicker;
