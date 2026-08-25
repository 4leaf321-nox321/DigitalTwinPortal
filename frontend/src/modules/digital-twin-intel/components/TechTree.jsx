import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { ChevronRight, ChevronDown, AlertTriangle, Wrench } from 'lucide-react';

import { STAGES } from './RadarBoard';

/**
 * **계통** — 역량 밑에 어떤 도구가 매달려 있는지를 그대로 편다.
 *
 * ⚠️⚠️ 목록(단계별 네 칸)에는 **포함관계가 안 보인다**(2026-08-25 신고). 역량과
 *    도구가 나란히 섞여 서고, 관계는 「⋯ 아래」라는 작은 글씨 하나뿐이다 —
 *    609줄에서 그건 안 읽힌다.
 *
 * ⚠️ **관계는 역량 1 : 도구 N 이다.** `parent_uuid` 가 칸 하나라서, 한 도구는
 *    역량 하나에만 매달린다. 같은 S/W 를 두 역량에서 쓰면 지금은 각 역량 밑에
 *    한 줄씩 두어야 한다 — 그래서 이 화면은 **나무**지 그물이 아니다.
 */
const UNCATEGORIZED = '분류 없음';

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Sector = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;

  > h3 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 700;
    color: #6366f1;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  > h3 em {
    font-style: normal;
    font-size: 0.6875rem;
    color: #94a3b8;
    font-weight: 400;
  }
  > h3 span {
    flex: 1;
    height: 1px;
    background: #e0e7ff;
  }
`;

const Node = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: #fff;
  overflow: hidden;
`;

/* ⚠️ 펴고 접는 것과 **여는 것**을 갈라 둔다 — 한 단추로 겸하면 이름을 눌러
   상세를 열려던 사람이 자꾸 접었다 폈다 하게 된다. */
const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4375rem;
  padding: 0.4375rem 0.5rem;

  button {
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    color: #64748b;
  }

  b.name {
    font-size: 0.8125rem;
    color: #0f172a;
    cursor: pointer;
    text-align: left;
  }
  b.name:hover { color: #4338ca; text-decoration: underline; }

  q {
    flex: 1;
    min-width: 0;
    quotes: none;
    font-size: 0.6875rem;
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Badge = styled.span`
  flex-shrink: 0;
  padding: 0.0625rem 0.375rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: ${(p) => p.$color};
  background: ${(p) => p.$bg};
`;

const Count = styled.span`
  flex-shrink: 0;
  font-size: 0.6875rem;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
`;

const Kids = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0.25rem 0.5rem 0.5rem 1.75rem;
  border-top: 1px dashed #e2e8f0;
  background: #f8fafc;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.1875rem;

  li button {
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 0.1875rem 0.25rem;
    border-radius: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.3125rem;
    font: inherit;

    &:hover { background: #eef2ff; }

    span.n {
      flex: 1;
      min-width: 0;
      font-size: 0.75rem;
      color: #334155;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    em {
      font-style: normal;
      font-size: 0.625rem;
      color: #94a3b8;
      flex-shrink: 0;
    }
  }
`;

const Bare = styled.p`
  margin: 0;
  padding: 0.375rem 0.5rem 0.5rem 1.75rem;
  border-top: 1px dashed #e2e8f0;
  background: #f8fafc;
  font-size: 0.6875rem;
  color: #94a3b8;
`;

const Empty = styled.p`
  margin: 0;
  padding: 2rem;
  text-align: center;
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const stageOf = (key) => STAGES.find((s) => s.key === key) || STAGES[2];

const TechTree = ({ rows, all, categories, onSelect }) => {
  // 펴 놓은 역량. ⚠️ 63개를 다 펴면 600줄이 쏟아진다 — 접힌 채로 시작한다.
  const [open, setOpen] = useState({});

  const sectors = useMemo(() => {
    const shown = new Set((rows || []).map((t) => t.uuid));
    const caps = (all || []).filter((t) => t.kind === 'capability');
    const tools = (all || []).filter((t) => t.kind !== 'capability');

    const nodes = [];
    caps.forEach((c) => {
      const mine = tools.filter((t) => t.parentUuid === c.uuid);
      const hitKids = mine.filter((t) => shown.has(t.uuid));
      const capHit = shown.has(c.uuid);
      if (!capHit && hitKids.length === 0) return;
      /*
        ⚠️ 역량 이름으로 걸렀으면 **그 밑을 다 보여준다** — 「구조 해석」을 찾은
           사람이 보고 싶은 것은 그 역량이 아니라 **그 안에 무엇이 있나**이다.
      */
      nodes.push({ cap: c, kids: hitKids.length ? hitKids : mine });
    });

    // 아직 안 매단 도구. ⚠️ 0이어도 자리를 두지는 않는다 — 없으면 조용한 게 맞다.
    const orphans = tools.filter((t) => !t.parentUuid && shown.has(t.uuid));

    const by = new Map();
    nodes.forEach((n) => {
      const g = n.cap.category || UNCATEGORIZED;
      if (!by.has(g)) by.set(g, []);
      by.get(g).push(n);
    });
    const ordered = (categories || []).filter((g) => by.has(g));
    [...by.keys()].forEach((g) => { if (!ordered.includes(g)) ordered.push(g); });
    return { groups: ordered.map((g) => [g, by.get(g)]), orphans };
  }, [rows, all, categories]);

  const { groups, orphans } = sectors;
  if (!groups.length && !orphans.length) {
    return <Empty>걸리는 것이 없습니다.</Empty>;
  }

  const line = ({ cap, kids }) => {
    const st = stageOf(cap.stage);
    const isOpen = Boolean(open[cap.uuid]);
    return (
      <Node key={cap.uuid}>
        <Head>
          <button type="button" title={isOpen ? '접기' : '펴기'}
                  onClick={() => setOpen((p) => ({ ...p, [cap.uuid]: !isOpen }))}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <b className="name" role="button" tabIndex={0}
             onClick={() => onSelect(cap)}
             onKeyDown={(e) => { if (e.key === 'Enter') onSelect(cap); }}>
            {cap.name}
          </b>
          <Badge $color={st.color} $bg={st.bg}>{cap.stage}</Badge>
          {cap.isStale && (
            <Badge $color="#b45309" $bg="#fffbeb" title="근거가 오래 없습니다">
              <AlertTriangle size={10} /> 낡음
            </Badge>
          )}
          <q>{cap.summary || ''}</q>
          <Count title="이 역량에 매달린 도구 수">
            <Wrench size={11} /> {kids.length}
          </Count>
        </Head>

        {isOpen && (kids.length === 0 ? (
          <Bare>
            매달린 도구가 없습니다 — 「도구 관리」에서 넣으면 사업부가 「무엇으로
            하나」에서 고를 수 있게 됩니다.
          </Bare>
        ) : (
          <Kids>
            {kids.map((t) => (
              <li key={t.uuid}>
                <button type="button" onClick={() => onSelect(t)}>
                  <span className="n">{t.name}</span>
                  <em>{t.vendor || ''}</em>
                </button>
              </li>
            ))}
          </Kids>
        ))}
      </Node>
    );
  };

  return (
    <Wrap>
      {groups.map(([g, nodes]) => (
        <Sector key={g}>
          <h3>
            {g} <em>역량 {nodes.length} · 도구 {nodes.reduce((n, x) => n + x.kids.length, 0)}</em>
            <span />
          </h3>
          {nodes.map(line)}
        </Sector>
      ))}

      {/*
        ⚠️ 안 매단 도구는 **맨 뒤에 따로** 세운다. 역량 사이에 섞으면 「어디에도
           안 들어간 것」이라는 사실이 묻힌다 — 그 도구들은 어느 사업부 표에도
           안 나온다.
      */}
      {orphans.length > 0 && (
        <Sector>
          <h3>
            아직 안 매단 도구 <em>{orphans.length}개 — 어느 사업부 표에도 안 나옵니다</em>
            <span />
          </h3>
          <Node>
            <Kids style={{ borderTop: 'none', paddingLeft: '0.75rem' }}>
              {orphans.map((t) => (
                <li key={t.uuid}>
                  <button type="button" onClick={() => onSelect(t)}>
                    <span className="n">{t.name}</span>
                    <em>{t.vendor || ''}</em>
                  </button>
                </li>
              ))}
            </Kids>
          </Node>
        </Sector>
      )}
    </Wrap>
  );
};

export default TechTree;
