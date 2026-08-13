/**
 * 날짜 메모 창 — **그날 무슨 일이 있었는지 먼저 보여 주고**, 설명만 받는다.
 *
 * 왜 이 순서인가
 *     석 달 전 7/15 에 왜 5건이 줄었는지는 아무도 기억하지 못한다. 그런데 서버는
 *     그날 어느 과제가 들어오고 빠졌는지 이미 안다(곡선을 그 값으로 그린다).
 *     그러니 기계가 아는 것은 기계가 채우고, 사람은 **설명만** 적게 한다.
 *     그 순서를 뒤집으면 메모는 결국 안 쌓인다.
 *
 * 🐞 처음엔 **날짜당 메모 하나**만 다뤘다(`note` 하나를 받아 고치는 창).
 *    그래서 두 가지가 막혔다 —
 *      · 이미 메모가 있는 날짜를 누르면 그 메모의 **수정**이 열려서,
 *        같은 날 다른 사업부 메모를 **새로 만들 수가 없었다.**
 *      · 두 번째 메모는 아예 손이 닿지 않아 **지울 방법이 없었다.**
 *    그래서 목록 + 입력칸 형태로 바꿨다. 저장한 뒤에도 창을 닫지 않는다 —
 *    한 날짜에 사업부별로 여러 줄을 잇달아 적는 것이 흔한 쓰임이다.
 *
 * ⚠️ 변동 목록은 **서버가 곡선과 같은 기준**(`_project_span`)으로 뽑는다.
 *    여기서 과제 목록을 따로 세면 "곡선은 5건 줄었다는데 목록은 3건" 이 된다.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  AlertTriangle, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, X,
} from 'lucide-react';

import { deleteTrendNote, fetchDayChanges, saveTrendNote } from '../../services/trendApi';

const ALL = '전체';

const NoteModal = ({
  date, allNotes = [], division, divisions = [], scope, canEdit,
  onClose, onChanged,
}) => {
  const [day, setDay] = useState(date || '');
  const [editing, setEditing] = useState(null);      // 고치는 중인 메모 (없으면 새 메모)
  const [text, setText] = useState('');
  const [div, setDiv] = useState(division || ALL);
  const [changes, setChanges] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Esc 로 닫기 — 창을 열어 놓고 빠져나갈 길이 X 하나뿐이면 답답하다.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 날짜를 바꾸면 그날의 변동을 다시 읽는다.
  useEffect(() => {
    if (!day) return undefined;
    let dead = false;
    setLoading(true);
    fetchDayChanges(day, scope)
      .then(d => { if (!dead) setChanges(d); })
      .catch(err => { if (!dead) setError(err.message); })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [day, scope]);

  // 목록은 **부모가 준 최신 메모**에서 그때그때 추린다. 창 안에 따로 복사해 두면
  // 저장·삭제 뒤에 목록만 옛것으로 남는다.
  const dayNotes = useMemo(
    () => allNotes.filter(n => n.date === day), [allNotes, day]);
  const otherNotes = useMemo(
    () => allNotes.filter(n => n.date !== day), [allNotes, day]);

  // 고치던 메모가 사라졌으면(다른 창에서 지웠거나) 새 메모 모드로 돌아간다.
  useEffect(() => {
    if (editing && !allNotes.some(n => n.id === editing.id)) {
      setEditing(null);
      setText('');
    }
  }, [allNotes, editing]);

  const startEdit = useCallback((n) => {
    setEditing(n);
    setText(n.text);
    setDiv(n.division || ALL);
    setDay(n.date);
    setError(null);
  }, []);

  const startNew = useCallback(() => {
    setEditing(null);
    setText('');
    setDiv(division || ALL);
    setError(null);
  }, [division]);

  const save = useCallback(() => {
    setBusy(true);
    setError(null);
    saveTrendNote({ id: editing?.id, date: day, division: div, text })
      .then(() => {
        // 저장해도 **창은 닫지 않는다** — 같은 날 다른 사업부를 잇달아 적는다.
        setEditing(null);
        setText('');
        onChanged();
      })
      .catch(err => setError(err.message))
      .finally(() => setBusy(false));
  }, [editing, day, div, text, onChanged]);

  const remove = useCallback((n) => {
    setBusy(true);
    setError(null);
    deleteTrendNote(n.id)
      .then(() => { if (editing?.id === n.id) startNew(); onChanged(); })
      .catch(err => setError(err.message))
      .finally(() => setBusy(false));
  }, [editing, startNew, onChanged]);

  const summary = useMemo(() => {
    if (!changes) return null;
    const parts = [];
    if (changes.addedCount) parts.push(`+${changes.addedCount}건`);
    if (changes.removedCount) parts.push(`−${changes.removedCount}건`);
    return parts.length ? parts.join(' / ') : '변동 없음';
  }, [changes]);

  const row = (n, withDate) => (
    <NoteRow key={n.id} $on={editing?.id === n.id}>
      {withDate && (
        <RowDate onClick={() => startEdit(n)} title="이 날짜로 이동">
          {shortDate(n.date)}
        </RowDate>
      )}
      <RowDiv $all={!n.division || n.division === ALL}>
        {n.division || ALL}
      </RowDiv>
      <RowText title={`${n.text}\n— ${n.updatedBy || n.createdBy || ''}`}>
        {n.text}
      </RowText>
      {canEdit && (
        <>
          <RowBtn onClick={() => startEdit(n)} title="고치기">
            <Pencil size={13} />
          </RowBtn>
          <RowBtn $danger onClick={() => remove(n)} disabled={busy} title="지우기">
            <Trash2 size={13} />
          </RowBtn>
        </>
      )}
    </NoteRow>
  );

  return (
    <Backdrop onMouseDown={onClose}>
      <Box onMouseDown={e => e.stopPropagation()}>
        <Head>
          <Title>날짜 메모</Title>
          <IconBtn onClick={onClose} title="닫기"><X size={16} /></IconBtn>
        </Head>

        <Row>
          <Label>날짜</Label>
          <Input type="date" value={day}
                 onChange={e => { setDay(e.target.value); setEditing(null); }} />
        </Row>

        {/* ── 그날의 변동 — 사람이 기억해 낼 필요가 없게 ── */}
        <Section>
          <SectionHead>
            그날의 변동
            {summary && <Badge>{summary}</Badge>}
            {loading && <Loader2 size={13} className="spin" />}
          </SectionHead>
          <Changes>
            {!loading && changes && !changes.addedCount && !changes.removedCount && (
              <Muted>이 날짜에 들어오거나 빠진 과제가 없습니다.</Muted>
            )}
            {(changes?.added || []).map(p => (
              <ChangeRow key={`a-${p.uuid}`}>
                <Mark $in>들어옴</Mark>
                <Div>{p.division}</Div>
                <Name title={p.title}>{p.title}</Name>
              </ChangeRow>
            ))}
            {(changes?.removed || []).map(p => (
              <ChangeRow key={`r-${p.uuid}`}>
                <Mark>빠짐</Mark>
                <Div>{p.division}</Div>
                <Name title={p.title}>{p.title}</Name>
                <Why>{p.why}</Why>
              </ChangeRow>
            ))}
            {changes?.truncated && <Muted>목록이 길어 일부만 보여 줍니다.</Muted>}
          </Changes>
        </Section>

        {/* ── 이 날짜에 이미 달린 메모 ── */}
        <Section>
          <SectionHead>
            이 날짜의 메모
            {dayNotes.length > 0 && <Badge>{dayNotes.length}</Badge>}
          </SectionHead>
          {dayNotes.length === 0
            ? <Muted>아직 없습니다. 아래에서 적어 주세요.</Muted>
            : <NoteList>{dayNotes.map(n => row(n, false))}</NoteList>}
        </Section>

        {/* ── 적기 — 사업부마다 한 줄씩 여러 개를 달 수 있다 ── */}
        {canEdit && (
          <Section>
            <SectionHead>
              {editing ? '메모 고치기' : <><Plus size={12} />새 메모</>}
              {editing && (
                <LinkBtn onClick={startNew}>새로 쓰기로 바꾸기</LinkBtn>
              )}
            </SectionHead>
            <Row>
              <Label>사업부</Label>
              <Select value={div} onChange={e => setDiv(e.target.value)}>
                <option value={ALL}>전체</option>
                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
              <Muted>사업부를 바꿔 가며 여러 줄을 달 수 있습니다.</Muted>
            </Row>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={500}
              placeholder="예) 상반기 과제 정리 — 3건은 하반기로 이월"
            />
            <Count>{text.length} / 500</Count>
          </Section>
        )}

        {/* ── 다른 날짜 메모 — 여기서도 지울 수 있어야 한다 ── */}
        {otherNotes.length > 0 && (
          <Section>
            <SectionHead as="button" onClick={() => setShowAll(v => !v)}
                         style={{ cursor: 'pointer', background: 'none',
                                  border: 'none', padding: 0, font: 'inherit' }}>
              {showAll ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              다른 날짜의 메모
              <Badge>{otherNotes.length}</Badge>
            </SectionHead>
            {showAll && <NoteList>{otherNotes.map(n => row(n, true))}</NoteList>}
          </Section>
        )}

        {error && <Banner><AlertTriangle size={14} />{error}</Banner>}
        {!canEdit && <Muted>읽기 전용입니다. 메모는 사무국·관리자가 씁니다.</Muted>}

        <Foot>
          <Spacer />
          <GhostBtn onClick={onClose}>닫기</GhostBtn>
          {canEdit && (
            <PrimaryBtn onClick={save} disabled={busy || !text.trim() || !day}>
              {busy ? '저장 중…' : (editing ? '고친 내용 저장' : '메모 추가')}
            </PrimaryBtn>
          )}
        </Foot>
      </Box>
    </Backdrop>
  );
};

/** 'YYYY-MM-DD' → '7/28'. 목록 한 줄에 연도까지 쓸 자리가 없다. */
const shortDate = (d) => {
  const [, m, day] = String(d).split('-');
  return `${Number(m)}/${Number(day)}`;
};

/* ── 스타일 ── */

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.45);
`;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: min(580px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  padding: 1rem 1.15rem 1.15rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.28);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const IconBtn = styled.button`
  margin-left: auto;
  display: inline-flex;
  padding: 0.3rem;
  color: #64748b;
  background: none;
  border: none;
  border-radius: 0.35rem;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Label = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
`;

const Input = styled.input`
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  border-radius: 0.4rem;
`;

const Select = styled.select`
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  border-radius: 0.4rem;
  background: white;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;

  .spin { animation: spin 1s linear infinite; color: #94a3b8; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const LinkBtn = styled.button`
  margin-left: auto;
  padding: 0;
  font-size: 0.7rem;
  font-weight: 600;
  color: #4f46e5;
  background: none;
  border: none;
  cursor: pointer;
  &:hover { text-decoration: underline; }
`;

const Badge = styled.span`
  padding: 0.05rem 0.4rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: #334155;
  background: #f1f5f9;
  border-radius: 9999px;
  font-variant-numeric: tabular-nums;
`;

const Changes = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  max-height: 150px;
  overflow-y: auto;
  padding: 0.4rem 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const ChangeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: #334155;
  min-width: 0;
`;

const Mark = styled.span`
  flex-shrink: 0;
  padding: 0.02rem 0.32rem;
  border-radius: 9999px;
  font-size: 0.63rem;
  font-weight: 700;
  color: ${p => (p.$in ? '#047857' : '#b91c1c')};
  background: ${p => (p.$in ? '#d1fae5' : '#fee2e2')};
`;

const Div = styled.span`
  flex-shrink: 0;
  font-size: 0.63rem;
  font-weight: 700;
  color: #64748b;
`;

const Name = styled.span`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const Why = styled.span`
  flex-shrink: 0;
  margin-left: auto;
  padding-left: 0.4rem;
  font-size: 0.63rem;
  color: #94a3b8;
`;

/* ── 메모 목록 ── */

const NoteList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  max-height: 160px;
  overflow-y: auto;
`;

const NoteRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.25rem 0.35rem;
  font-size: 0.74rem;
  color: #334155;
  border: 1px solid ${p => (p.$on ? '#a5b4fc' : '#e2e8f0')};
  background: ${p => (p.$on ? '#eef2ff' : 'white')};
  border-radius: 0.4rem;
`;

const RowDate = styled.button`
  flex-shrink: 0;
  padding: 0;
  font-size: 0.7rem;
  font-weight: 700;
  color: #4f46e5;
  background: none;
  border: none;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
  &:hover { text-decoration: underline; }
`;

const RowDiv = styled.span`
  flex-shrink: 0;
  padding: 0.02rem 0.35rem;
  border-radius: 9999px;
  font-size: 0.63rem;
  font-weight: 700;
  color: ${p => (p.$all ? '#64748b' : '#3730a3')};
  background: ${p => (p.$all ? '#f1f5f9' : '#e0e7ff')};
`;

const RowText = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const RowBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  padding: 0.15rem;
  color: ${p => (p.$danger ? '#b91c1c' : '#64748b')};
  background: none;
  border: none;
  border-radius: 0.3rem;
  cursor: pointer;

  &:hover:not(:disabled) { background: ${p => (p.$danger ? '#fef2f2' : '#f1f5f9')}; }
  &:disabled { opacity: 0.4; cursor: default; }
`;

const Textarea = styled.textarea`
  min-height: 66px;
  padding: 0.5rem 0.6rem;
  font-size: 0.8rem;
  font-family: inherit;
  line-height: 1.5;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  resize: vertical;

  &:focus { outline: 2px solid #c7d2fe; border-color: #6366f1; }
`;

const Count = styled.div`
  align-self: flex-end;
  font-size: 0.66rem;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
`;

const Muted = styled.div`
  font-size: 0.72rem;
  color: #94a3b8;
`;

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  font-size: 0.75rem;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 0.5rem;
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.2rem;
`;

const Spacer = styled.div`flex: 1;`;

const btn = `
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 0.5rem;
  cursor: pointer;
  &:disabled { opacity: 0.55; cursor: default; }
`;

const GhostBtn = styled.button`
  ${btn}
  color: #334155;
  background: white;
  border: 1px solid #cbd5e1;
  &:hover:not(:disabled) { background: #f1f5f9; }
`;

const PrimaryBtn = styled.button`
  ${btn}
  color: white;
  background: #4f46e5;
  border: 1px solid #4f46e5;
  &:hover:not(:disabled) { background: #4338ca; }
`;

export default NoteModal;
