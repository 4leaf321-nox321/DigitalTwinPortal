import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Search, Check } from 'lucide-react';

// 도구 찾기 — 기술정보 모듈의 도구 전체(684개)를 분야별로 펼쳐 놓고 검색해 여럿 고른다.
//
// 드롭다운 제안은 이름을 이미 아는 사람용이다. 모르는 사람은 **분야를 훑어야** 찾는다.
// 그래서 왼쪽에 분야 토글, 오른쪽에 그 분야의 도구. 검색은 이름·공급사 둘 다 본다.
// 이미 붙은 도구는 표시만 하고 다시 넣지 않는다.

const Backdrop = styled.div`
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5);
  display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1.5rem;
`;
const Panel = styled.div`
  background: white; border-radius: 0.75rem; width: min(64rem, 94vw); height: min(38rem, 84vh);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3); display: flex; flex-direction: column; overflow: hidden;
`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.875rem 1.125rem; border-bottom: 1px solid #e2e8f0;`;
const Title = styled.h3`margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b;`;
const Count = styled.span`font-size: 0.8125rem; color: #94a3b8;`;
const CloseButton = styled.button`
  margin-left: auto; border: none; background: transparent; color: #94a3b8; cursor: pointer;
  padding: 0.25rem; border-radius: 0.25rem; &:hover { color: #475569; background: #f1f5f9; }
`;
const SearchRow = styled.div`
  display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.125rem; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
  input { flex: 1; font-size: 0.875rem; padding: 0.4rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; }
`;
const Two = styled.div`flex: 1; min-height: 0; display: grid; grid-template-columns: 14rem 1fr; @media (max-width: 800px) { grid-template-columns: 1fr; }`;
const Cats = styled.div`border-right: 1px solid #e2e8f0; overflow-y: auto; padding: 0.5rem;`;
const Cat = styled.button`
  width: 100%; text-align: left; border: 1px solid ${p => (p.$on ? '#93c5fd' : 'transparent')}; background: ${p => (p.$on ? '#eff6ff' : 'transparent')};
  border-radius: 0.375rem; padding: 0.35rem 0.5rem; font: inherit; font-size: 0.8125rem; cursor: pointer; display: flex; gap: 0.4rem;
  color: #0f172a; font-weight: ${p => (p.$on ? 700 : 400)}; &:hover { background: #f1f5f9; }
  em { font-style: normal; margin-left: auto; color: #94a3b8; font-size: 0.6875rem; }
`;
const Grid = styled.div`overflow-y: auto; padding: 0.5rem 0.75rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.25rem; align-content: start;`;
const Item = styled.button`
  text-align: left; border: 1px solid ${p => (p.$on ? '#93c5fd' : p.$have ? '#e2e8f0' : 'transparent')};
  background: ${p => (p.$on ? '#eff6ff' : p.$have ? '#f8fafc' : 'transparent')}; border-radius: 0.375rem; padding: 0.35rem 0.5rem;
  font: inherit; font-size: 0.8125rem; cursor: ${p => (p.$have ? 'default' : 'pointer')}; display: flex; align-items: center; gap: 0.4rem;
  color: ${p => (p.$have ? '#94a3b8' : '#0f172a')}; &:hover { background: ${p => (p.$have ? '#f8fafc' : '#f1f5f9')}; }
  b { font-weight: ${p => (p.$on ? 700 : 500)}; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { color: #94a3b8; font-size: 0.6875rem; white-space: nowrap; }
`;
const Foot = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1rem; border-top: 1px solid #e2e8f0; background: #f8fafc; font-size: 0.8125rem; color: #64748b;`;
const Primary = styled.button`
  margin-left: auto; border: none; background: #1d4ed8; color: #fff; font-weight: 600; font-size: 0.8125rem; padding: 0.4375rem 0.9375rem;
  border-radius: 0.375rem; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 0.3rem;
  &:disabled { background: #bfdbfe; cursor: not-allowed; }
`;
const Ghost = styled.button`
  border: 1px solid #e2e8f0; background: #fff; color: #64748b; font-size: 0.8125rem; padding: 0.4375rem 0.75rem; border-radius: 0.375rem; cursor: pointer; font-family: inherit;
`;
const Msg = styled.p`margin: 0; padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.8125rem; grid-column: 1 / -1;`;

const ALL = '__all__';

const ToolPickerModal = ({ catalog = [], have = [], title = '도구 찾기', countLabel = '기술정보 모듈의 도구', onPick, onClose }) => {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(ALL);
  const [picked, setPicked] = useState([]);
  const haveSet = useMemo(() => new Set(have), [have]);

  const cats = useMemo(() => {
    const c = {};
    catalog.forEach(t => { c[t.category] = (c[t.category] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
  }, [catalog]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog.filter(t =>
      (cat === ALL || t.category === cat)
      && (!needle || t.name.toLowerCase().includes(needle) || (t.vendor || '').toLowerCase().includes(needle)));
  }, [catalog, q, cat]);

  const toggle = (name) => {
    if (haveSet.has(name)) return;
    setPicked(p => (p.includes(name) ? p.filter(x => x !== name) : [...p, name]));
  };

  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <Head>
          <Title>{title}</Title>
          <Count>{countLabel} {catalog.length}개</Count>
          <CloseButton onClick={onClose} title="닫기"><X size={18} /></CloseButton>
        </Head>
        <SearchRow>
          <Search size={14} color="#94a3b8" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="이름으로 찾기" />
          <Count>{shown.length}개</Count>
        </SearchRow>
        <Two>
          <Cats>
            <Cat type="button" $on={cat === ALL} onClick={() => setCat(ALL)}>전체 <em>{catalog.length}</em></Cat>
            {cats.map(([c, n]) => (
              <Cat key={c} type="button" $on={cat === c} onClick={() => setCat(c)}>{c} <em>{n}</em></Cat>
            ))}
          </Cats>
          <Grid>
            {shown.length === 0 && <Msg>맞는 것이 없습니다. 목록에 없는 이름은 입력칸에 직접 적으면 됩니다.</Msg>}
            {shown.map(t => {
              const has = haveSet.has(t.name);
              const on = picked.includes(t.name);
              return (
                <Item key={t.name} type="button" $on={on} $have={has} onClick={() => toggle(t.name)}
                      title={has ? '이미 붙어 있습니다' : t.vendor || ''}>
                  {(on || has) && <Check size={12} />}
                  <b>{t.name}</b>
                  {t.vendor && <small>{t.vendor}</small>}
                </Item>
              );
            })}
          </Grid>
        </Two>
        <Foot>
          {picked.length > 0 ? <>{picked.join(' · ')}</> : '누르면 골라지고, 여럿 골라 한 번에 넣습니다.'}
          <Ghost type="button" onClick={onClose}>취소</Ghost>
          <Primary type="button" disabled={picked.length === 0} onClick={() => { onPick(picked); onClose(); }}>
            <Check size={13} /> {picked.length ? `${picked.length}개 넣기` : '넣기'}
          </Primary>
        </Foot>
      </Panel>
    </Backdrop>
  );
};

export default ToolPickerModal;
