/**
 * 메인 화면 모듈 설정 — **상태**(운영 중 / 운영 준비 / 기획 중 / 숨김)와 **차례**.
 *
 * 왜 만들었나
 *     상태가 `MainPage.STATUS_BY_ID` 에 박혀 있어서, 「이 모듈을 운영 중으로
 *     올리자」 같은 판단 하나에 **프론트를 다시 빌드해 반입**해야 했다.
 *     상태는 운영하며 자주 바뀌는 값이지 코드가 아니다.
 *
 * ⚠️ **'숨김' 은 남의 눈에서 기능을 지우는 일이다.** 그래서 이 창은 관리자에게만
 *    열리고(서버가 `canEdit` 으로 알려 준다), 숨긴 것이 몇 개인지 늘 보이게 둔다 —
 *    숨겨 놓고 잊으면 "그 화면이 사라졌다" 는 문의로 돌아온다.
 *
 * ⚠️ 저장은 **통째로** 보낸다. 부분 갱신을 만들면 어느 쪽이 정본인지 헷갈린다.
 *
 * ⚠️ 차례는 **끌어서** 바꾼다. 다만 검색으로 걸러 놓은 상태에서는 못 끌게 막았다 —
 *    보이지 않는 줄을 사이에 두고 옮기면 결과가 예상과 달라진다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { AlertTriangle, EyeOff, GripVertical, Loader2, X } from 'lucide-react';

import { fetchModuleStatuses, saveModuleStatuses } from '../services/portalApi';

const ModuleStatusModal = ({
  open, onClose, modules, statusGroups, defaultStatusById, onSaved,
}) => {
  const [draft, setDraft] = useState({});
  const [order, setOrder] = useState([]);       // 모듈 id 차례
  const [dragId, setDragId] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');

  // 서버가 준 값이 정본이고, 없는 모듈만 화면 기본값을 따른다.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetchModuleStatuses()
      .then(d => {
        const merged = {};
        modules.forEach(m => {
          merged[m.id] = d.statuses?.[m.id] || defaultStatusById[m.id] || 'planning';
        });
        setDraft(merged);
        // 저장된 차례를 먼저 놓고, 거기 없는 모듈은 **원래 차례대로 뒤에** 붙인다.
        // 새 모듈이 생겨도 사라지지 않고 끝에 나타난다.
        const saved = (d.order || []).filter(id => modules.some(m => m.id === id));
        const rest = modules.map(m => m.id).filter(id => !saved.includes(id));
        setOrder([...saved, ...rest]);
        setCanEdit(!!d.canEdit);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, modules, defaultStatusById]);

  /** 차례대로 늘어놓은 모듈. 검색은 그 위에 얹는다(차례는 그대로다). */
  const ordered = useMemo(() => {
    const byId = new Map(modules.map(m => [m.id, m]));
    const out = order.map(id => byId.get(id)).filter(Boolean);
    modules.forEach(m => { if (!order.includes(m.id)) out.push(m); });
    return out;
  }, [modules, order]);

  const filtering = q.trim().length > 0;

  const shown = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return ordered;
    return ordered.filter(m =>
      (m.name || '').toLowerCase().includes(key)
      || (m.id || '').toLowerCase().includes(key));
  }, [ordered, q]);

  /** 끌어 놓기 — 지나가는 자리마다 바로 자리를 바꾼다(놓을 때가 아니라). */
  const dragOver = (overId) => {
    if (!dragId || dragId === overId) return;
    setOrder(prev => {
      const from = prev.indexOf(dragId);
      const to = prev.indexOf(overId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  };

  const counts = useMemo(() => {
    const c = {};
    Object.values(draft).forEach(v => { c[v] = (c[v] || 0) + 1; });
    return c;
  }, [draft]);

  const save = () => {
    setBusy(true);
    setError(null);
    saveModuleStatuses(draft, ordered.map(m => m.id))
      .then(() => { onSaved(draft, ordered.map(m => m.id)); onClose(); })
      .catch(err => setError(err.message))
      .finally(() => setBusy(false));
  };

  if (!open) return null;

  const groups = [...statusGroups,
    { key: 'hidden', label: '숨김', color: '#94a3b8', bg: '#f1f5f9', border: '#e2e8f0' }];

  return (
    <Backdrop onMouseDown={onClose}>
      <Box onMouseDown={e => e.stopPropagation()}>
        <Head>
          <Title>모듈 상태 설정</Title>
          <IconBtn onClick={onClose}><X size={17} /></IconBtn>
        </Head>

        <Lead>
          메인 화면에서 각 모듈이 <b>어느 묶음에</b> 놓일지, <b>어느 차례로</b> 보일지 정합니다.
          <b>숨김</b>으로 두면 목록에서 아예 빠집니다.
          차례는 왼쪽 손잡이를 끌어서 바꿉니다.
        </Lead>

        <Bar>
          {groups.map(g => (
            <Tally key={g.key} style={{ color: g.color, background: g.bg, borderColor: g.border }}>
              {g.key === 'hidden' && <EyeOff size={12} />}
              {g.label} {counts[g.key] || 0}
            </Tally>
          ))}
          <Spacer />
          <Search value={q} onChange={e => setQ(e.target.value)} placeholder="모듈 검색" />
        </Bar>

        {error && <Banner><AlertTriangle size={14} />{error}</Banner>}
        {filtering && canEdit && (
          <Banner>
            검색 중에는 차례를 못 바꿉니다 — 안 보이는 줄을 사이에 두고 옮기면
            결과가 예상과 달라집니다. 검색을 비우고 옮기세요.
          </Banner>
        )}
        {!loading && !canEdit && (
          <Banner>읽기 전용입니다. 모듈 상태는 관리자만 바꿀 수 있습니다.</Banner>
        )}

        <List>
          {loading && <Muted><Loader2 size={14} className="spin" /> 읽는 중…</Muted>}
          {!loading && shown.length === 0 && <Muted>찾는 모듈이 없습니다.</Muted>}
          {!loading && shown.map((m, i) => (
            <Row
              key={m.id}
              $off={draft[m.id] === 'hidden'}
              $dragging={dragId === m.id}
              draggable={canEdit && !filtering}
              onDragStart={() => setDragId(m.id)}
              onDragOver={(e) => { e.preventDefault(); dragOver(m.id); }}
              onDragEnd={() => setDragId(null)}
              onDrop={(e) => { e.preventDefault(); setDragId(null); }}
            >
              <Grip $on={canEdit && !filtering}
                    title={filtering ? '검색을 비우면 끌 수 있습니다' : '끌어서 차례 바꾸기'}>
                <GripVertical size={14} />
              </Grip>
              <Seq>{filtering ? '' : i + 1}</Seq>
              <Name>
                <b>{m.name}</b>
                <small>{m.id}</small>
              </Name>
              <Picks>
                {groups.map(g => {
                  const on = draft[m.id] === g.key;
                  return (
                    <Pick
                      key={g.key}
                      type="button"
                      disabled={!canEdit}
                      $on={on}
                      style={on ? { color: g.color, background: g.bg, borderColor: g.border } : undefined}
                      onClick={() => setDraft(p => ({ ...p, [m.id]: g.key }))}
                    >
                      {g.label}
                    </Pick>
                  );
                })}
              </Picks>
            </Row>
          ))}
        </List>

        <Foot>
          <Muted>바꾼 내용은 모든 사용자의 첫 화면에 그대로 보입니다.</Muted>
          <Spacer />
          <Ghost onClick={onClose}>닫기</Ghost>
          {canEdit && (
            <Primary onClick={save} disabled={busy || loading}>
              {busy ? '저장 중…' : '저장'}
            </Primary>
          )}
        </Foot>
      </Box>
    </Backdrop>
  );
};

/* ── 스타일 ── */

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
`;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(820px, 96vw);
  max-height: 88vh;
  padding: 18px 20px 16px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #1e293b;
`;

const IconBtn = styled.button`
  margin-left: auto;
  display: inline-flex;
  padding: 4px;
  color: #64748b;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const Lead = styled.p`
  margin: 0;
  flex-shrink: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #475569;
`;

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

const Tally = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  font-size: 11.5px;
  font-weight: 700;
  border: 1px solid;
  border-radius: 9999px;
`;

const Spacer = styled.div`flex: 1;`;

const Search = styled.input`
  padding: 5px 9px;
  font-size: 12.5px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
`;

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 7px 10px;
  font-size: 12.5px;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
`;

const List = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Row = styled.div`
  /* 부모가 세로 flex 스크롤 상자다. 안 박아 두면 모듈이 늘 때 전부 납작해진다. */
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 9px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: ${p => (p.$dragging ? '#eef2ff' : p.$off ? '#f8fafc' : '#fff')};
  opacity: ${p => (p.$dragging ? 0.75 : p.$off ? 0.65 : 1)};
  border-color: ${p => (p.$dragging ? '#a5b4fc' : '#e2e8f0')};
`;

const Grip = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  color: ${p => (p.$on ? '#cbd5e1' : '#eef2f7')};
  cursor: ${p => (p.$on ? 'grab' : 'not-allowed')};

  &:active { cursor: grabbing; }
`;

const Seq = styled.span`
  flex-shrink: 0;
  width: 20px;
  font-size: 11px;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
  text-align: right;
`;

const Name = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;

  b { font-size: 13px; font-weight: 600; color: #1e293b;
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  small { font-size: 10.5px; color: #94a3b8; }
`;

const Picks = styled.div`
  display: flex;
  gap: 4px;
  flex-shrink: 0;
`;

const Pick = styled.button`
  padding: 4px 10px;
  font-size: 11.5px;
  font-weight: ${p => (p.$on ? 700 : 500)};
  color: #64748b;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  cursor: pointer;
  white-space: nowrap;

  &:disabled { cursor: default; opacity: 0.6; }
  &:hover:not(:disabled) { border-color: #cbd5e1; }
`;

const Muted = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #94a3b8;

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const Ghost = styled.button`
  padding: 7px 15px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
`;

const Primary = styled.button`
  padding: 7px 15px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: #4f46e5;
  border: 1px solid #4f46e5;
  border-radius: 8px;
  cursor: pointer;
  &:disabled { opacity: 0.55; cursor: default; }
`;

export default ModuleStatusModal;
