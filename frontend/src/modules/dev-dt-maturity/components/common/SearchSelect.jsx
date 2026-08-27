import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, X } from 'lucide-react';

// 검색되는 고르기 — 목록이 길어지는 칸(담당 부서 …)에. 글자를 치면 좁혀지고, 누르면 골라진다.
//
// 드롭다운(select)은 수십 개를 넘으면 못 찾는다. 이 부품은 input 하나에 아래로 펼쳐지는
// 목록을 붙인 것이라 키보드(↑↓ Enter Esc)로도 된다. 값은 option 의 id 로 주고받는다.
//
// ⚠️ 목록 바깥을 누르면 닫히고, 치던 글자는 버린다 — 골라진 값이 정본이다.

const Wrap = styled.div`position: relative; min-width: 0;`;
const Box = styled.div`
  display: flex; align-items: center; gap: 0.25rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: white;
  padding: 0 0.3rem 0 0.5rem; &:focus-within { border-color: #1d4ed8; }
  input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 0.8125rem; padding: 0.4rem 0; background: transparent; }
  input:disabled { color: #64748b; }
  button { border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0.15rem; display: inline-flex; &:hover { color: #475569; } &:disabled { cursor: default; opacity: 0.4; } }
`;
const List = styled.ul`
  position: absolute; left: 0; right: 0; top: calc(100% + 2px); z-index: 20; margin: 0; padding: 0.25rem; list-style: none;
  max-height: 14rem; overflow-y: auto; background: white; border: 1px solid #e2e8f0; border-radius: 0.375rem; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
`;
const Item = styled.li`
  padding: 0.35rem 0.5rem; border-radius: 0.3rem; font-size: 0.8125rem; cursor: pointer; color: #0f172a;
  background: ${p => (p.$active ? '#eff6ff' : 'transparent')}; font-weight: ${p => (p.$on ? 700 : 400)};
  &:hover { background: #f1f5f9; }
  small { color: #94a3b8; margin-left: 0.4rem; }
`;
const Empty = styled.li`padding: 0.5rem; font-size: 0.75rem; color: #94a3b8;`;

const SearchSelect = ({ options = [], value, onChange, placeholder = '찾아서 고르기', disabled = false, emptyLabel = '— 안 정함 —', allowEmpty = true, hint = null }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const wrap = useRef(null);
  const current = options.find(o => String(o.id) === String(value ?? '')) || null;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return options.filter(o => !needle || o.name.toLowerCase().includes(needle) || (o.sub || '').toLowerCase().includes(needle));
  }, [options, q]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  useEffect(() => { setActive(0); }, [q, open]);

  const pick = (o) => { onChange(o ? o.id : null); setOpen(false); setQ(''); };
  const onKey = (e) => {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); e.preventDefault(); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { setActive(a => Math.min(shown.length - 1, a + 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setActive(a => Math.max(0, a - 1)); e.preventDefault(); }
    else if (e.key === 'Enter') { if (shown[active]) pick(shown[active]); e.preventDefault(); }
    else if (e.key === 'Escape') { setOpen(false); setQ(''); }
  };

  return (
    <Wrap ref={wrap}>
      <Box>
        <input value={open ? q : (current ? current.name : '')} placeholder={current ? current.name : placeholder} disabled={disabled}
               onFocus={() => !disabled && setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true); }} onKeyDown={onKey}
               aria-label={placeholder} data-search-select />
        {allowEmpty && current && !disabled && (
          <button type="button" title="비우기" onClick={() => pick(null)}><X size={13} /></button>
        )}
        <button type="button" title="펼치기" disabled={disabled} onClick={() => setOpen(v => !v)}><ChevronDown size={14} /></button>
      </Box>
      {open && !disabled && (
        <List role="listbox">
          {allowEmpty && !q && <Item role="option" $on={!current} onMouseDown={e => e.preventDefault()} onClick={() => pick(null)}>{emptyLabel}</Item>}
          {shown.map((o, i) => (
            <Item key={o.id} role="option" $active={i === active} $on={current && current.id === o.id}
                  onMouseDown={e => e.preventDefault()} onClick={() => pick(o)}>
              {o.name}{o.sub && <small>{o.sub}</small>}
            </Item>
          ))}
          {shown.length === 0 && <Empty>{hint || '맞는 것이 없습니다.'}</Empty>}
        </List>
      )}
    </Wrap>
  );
};

export default SearchSelect;
