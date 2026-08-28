import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Check, History, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import { colorFor, reachedDates } from '../../utils/board';
import { AccuracyPreview, DEFAULT_RULE } from '../Settings/SettingsModal';

// 쌍 상세 — 사다리를 **그 안에서** 그린다. (PLAN 7-1)
//
// 축마다 가로 스텝: 지나온 칸엔 도달일, 현재 칸은 채움. 칸을 누르면 그 칸으로
// 옮기는 편집이 열리고 근거를 적는다. 정확도만 다르다 — 값을 적고 칸은 환산된다.
//
// ⚠️ 다른 사업부 쌍은 단추가 사라지는 게 아니라 **이유가 적힌 채 꺼진다**(deny_reason).
// ⚠️ 근거 없이는 저장이 안 된다. 서버가 거절하고, 화면도 미리 막는다.

const Backdrop = styled.div`
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1.5rem;
`;
const Panel = styled.div`
  background: white; border-radius: 0.75rem; width: min(980px, 100%); max-height: 92vh;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; overflow: hidden;
`;
const Head = styled.div`
  display: flex; align-items: flex-start; gap: 0.75rem; padding: 1.125rem 1.25rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
`;
const Title = styled.h3`margin: 0; font-size: 1.05rem; font-weight: 700; color: #1e293b;`;
const Sub = styled.div`font-size: 0.8125rem; color: #64748b; margin-top: 0.2rem;`;
const CloseButton = styled.button`
  margin-left: auto; border: none; background: transparent; color: #94a3b8; cursor: pointer;
  padding: 0.25rem; border-radius: 0.25rem; &:hover { color: #475569; background: #f1f5f9; }
`;
const Body = styled.div`overflow-y: auto; padding: 0.75rem 1.25rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;`;
const Notice = styled.div`
  display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.6rem 0.75rem; border-radius: 0.5rem;
  background: ${p => (p.$bad ? '#fef2f2' : '#fffbeb')}; border: 1px solid ${p => (p.$bad ? '#fecaca' : '#fde68a')};
  color: ${p => (p.$bad ? '#991b1b' : '#92400e')}; font-size: 0.8125rem; line-height: 1.5;
`;
const HistBtn = styled.button`
  display: inline-flex; align-items: center; gap: 0.3rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#e2e8f0')}; background: ${p => (p.$on ? '#eff6ff' : 'white')};
  color: ${p => (p.$on ? '#1d4ed8' : '#64748b')}; border-radius: 999px; padding: 0.2rem 0.6rem; font-size: 0.75rem; font-family: inherit; cursor: pointer; margin-right: 0.4rem;
  &:hover { border-color: #1d4ed8; color: #1d4ed8; }
`;
const HistPanel = styled.div`border: 1px solid #bfdbfe; background: #f8fbff; border-radius: 0.5rem; padding: 0.6rem 0.875rem; margin: 0.5rem 0; max-height: 14rem; overflow: auto;`;
const AxisBlock = styled.div`border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.75rem 0.875rem;`;
const AxisHead = styled.div`display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;`;
const AxisName = styled.span`font-weight: 700; color: #1e293b;`;
const AxisQ = styled.span`font-size: 0.75rem; color: #94a3b8;`;
const Meta = styled.span`margin-left: auto; font-size: 0.75rem; color: #64748b;`;
const Stale = styled.span`
  font-size: 0.6875rem; font-weight: 700; color: #b45309; background: #fffbeb; border: 1px solid #fde68a;
  border-radius: 0.25rem; padding: 0.05rem 0.35rem;
`;
const Ladder = styled.div`display: flex; gap: 0.35rem; flex-wrap: wrap;`;
// div 다 — 칸 밑에 시점을 고치는 입력·단추가 들어가서(button 안에 button 은 안 된다).
const Rung = styled.div`
  user-select: none; min-width: 0; overflow: hidden;
  flex: 1 1 0; min-width: 96px; padding: 0.45rem 0.5rem; border-radius: 0.375rem; text-align: left;
  border: 2px solid ${p => (p.$current ? '#1d4ed8' : '#e2e8f0')};
  background: ${p => (p.$reached ? p.$color : 'white')};
  color: ${p => (p.$reached && p.$dark ? 'white' : '#1e293b')};
  font-family: inherit; font-size: 0.8125rem; cursor: ${p => (p.$editable ? 'pointer' : 'default')};
  opacity: ${p => (p.$editable || p.$reached ? 1 : 0.7)};
  &:hover { border-color: ${p => (p.$editable ? '#1d4ed8' : '#e2e8f0')}; }
`;
const RungLabel = styled.div`font-weight: 700;`;
const RungDate = styled.span`display: block;font-size: 0.6875rem; opacity: 0.8; margin-top: 0.1rem;`;
const Note = styled.div`font-size: 0.8125rem; color: #475569; margin-top: 0.5rem; line-height: 1.5;`;
const Editor = styled.div`
  margin-top: 0.6rem; padding: 0.7rem 0.75rem; background: #f8fafc; border: 1px dashed #cbd5e1;
  border-radius: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;
`;
const Row = styled.div`display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;`;
const Input = styled.input`
  padding: 0.4rem 0.55rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit;
  font-size: 0.8125rem; min-width: 0; flex: ${p => (p.$grow ? 1 : 'none')}; width: ${p => p.$w || 'auto'};
`;
const Button = styled.button`
  padding: 0.35rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: white;
  color: #475569; font-size: 0.8125rem; font-weight: 600; font-family: inherit; cursor: pointer;
  display: inline-flex; align-items: center; gap: 0.3rem;
  &:hover:not(:disabled) { border-color: #1d4ed8; color: #1d4ed8; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const Primary = styled(Button)`background: #1d4ed8; border-color: transparent; color: white;`;
const Tag = styled.span`
  font-size: 0.75rem; background: #eff6ff; color: #1e40af; border-radius: 0.25rem; padding: 0.1rem 0.4rem;
`;
const HistoryList = styled.div`display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.8125rem; color: #475569;`;
const HistoryRow = styled.div`display: flex; gap: 0.5rem; flex-wrap: wrap;`;
const When = styled.span`color: #94a3b8; min-width: 6.5rem;`;

// 시점은 **연-월**로만 보인다 — 날짜 단위는 필요 없다(2026-08-28).
const fmtDate = (iso) => (iso ? iso.slice(0, 7) : '');
const thisMonth = () => new Date().toISOString().slice(0, 7);
const isDark = (color) => ['#3b82f6', '#1d4ed8', '#1e3a8a'].includes(color);

/** 정확도 — 숫자까지 채워진 한 줄 막대. 세 영역(경향 일치 · 원인 분석 · 현상 재현)은 사업부 문턱으로 갈린다. */
const AccuracyBar = ({ axis, a, rule }) => {
  const m = Object.fromEntries((rule?.thresholds || []).map(t => [t.rung, Number(t.min)]));
  const q = m.quantitative ?? 70, c = m.correlated ?? 90;
  const value = a?.value != null ? Number(a.value) : null;
  const cur = a?.rung ? axis.rungs.find(r => r.key === a.rung) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontSize: '0.8125rem' }}>
        {value != null
          ? <><strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>{value}%</strong><span style={{ color: '#1d4ed8', fontWeight: 600 }}>{cur?.label}</span></>
          : <span style={{ color: '#94a3b8' }}>미검증 — 아직 값이 없습니다</span>}
        {a?.assessed_at && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>· {fmtDate(a.assessed_at)}</span>}
      </div>
      <div style={{ position: 'relative' }}>
        <AccuracyPreview q={q} c={c} boundary={rule?.boundary} rungs={axis.rungs} value={value} />
        {value != null && (
          // 채움 — 값까지 진하게 덮고, 그 자리에 눈금을 세운다
          <>
            <div style={{ position: 'absolute', inset: 0, width: `${Math.min(Math.max(value, 0), 100)}%`, background: 'rgba(29, 78, 216, 0.28)', borderRadius: '0.4rem 0 0 0.4rem', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '-0.2rem', bottom: '-0.2rem', left: `calc(${Math.min(Math.max(value, 0), 100)}% - 1px)`, width: '2px', background: '#1e293b', pointerEvents: 'none' }} title={`${value}%`} />
          </>
        )}
      </div>
    </div>
  );
};

/** 정확도 줄 — 저장마다 한 줄. 최근 것만 보이고, 나머지는 「자세히」. 지우면 남은 줄의 가장 늦은 것이 현재가 된다. */
const Entries = ({ entries, canEdit, busy, onRemove }) => {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  const all = [...entries].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id));
  const rows = open ? all : all.slice(0, 1);
  return (
    <HistoryList style={{ marginTop: '0.5rem' }}>
      {all.length > 1 && (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
                style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: '#1d4ed8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', padding: 0 }}>
          {open ? '접기' : `자세히 — 이전 기록 ${all.length - 1}건`}
        </button>
      )}
      {rows.map((c, i) => (
        <HistoryRow key={c.id} style={i === 0 ? { fontWeight: 600, color: '#1e293b' } : undefined}>
          <When>{fmtDate(c.created_at)}</When>
          <span style={{ minWidth: '3.5rem' }}>{c.after}%</span>
          <span style={{ color: '#94a3b8' }}>{c.actor_name}</span>
          {c.note && <span>“{c.note}”</span>}
          {canEdit && (
            <button type="button" disabled={busy} onClick={() => onRemove(c.id)} aria-label="정확도 줄 지우기" title="이 줄 지우기"
                    style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}>
              <Trash2 size={12} />
            </button>
          )}
        </HistoryRow>
      ))}
    </HistoryList>
  );
};

/** 칸 밑의 도달 시점 — 보이고, 연필로 고치고, 없으면 「시점 적기」. 클릭은 칸의 클릭과 따로 간다. */
const ReachedAt = ({ axis, rung, reached, canEdit, date, dating, setDating, save, busy }) => {
  const mine = dating && dating.axis === axis.key && dating.rung === rung.key;
  if (mine) {
    return (
      <RungDate onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem', minWidth: 0 }}>
        <input type="month" max={thisMonth()} value={dating.month} autoFocus
               onChange={e => setDating(s => ({ ...s, month: e.target.value }))}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') setDating(null); }}
               style={{ fontSize: '0.6875rem', width: '100%', minWidth: 0, boxSizing: 'border-box', fontFamily: 'inherit' }} />
        <button type="button" disabled={busy || !dating.month} onClick={save} title="이 달로"><Check size={10} /></button>
        <button type="button" onClick={() => setDating(null)} title="취소"><X size={10} /></button>
      </RungDate>
    );
  }
  if (!reached) return date ? <RungDate>{fmtDate(date)}</RungDate> : null;
  return (
    <RungDate onClick={e => { e.stopPropagation(); if (canEdit) setDating({ axis: axis.key, rung: rung.key, month: date ? date.slice(0, 7) : thisMonth() }); }}
              title={canEdit ? '이 칸에 올라온 시점을 고칩니다' : undefined} style={canEdit ? { cursor: 'pointer' } : undefined}>
      {date ? fmtDate(date) : (canEdit ? '시점 적기' : '')}
      {canEdit && <Pencil size={9} style={{ marginLeft: '0.2rem', opacity: 0.7 }} />}
    </RungDate>
  );
};

/** 묶음 축의 토글 — 「수동」을 누르면 전부 끈다. 다른 항목은 켜고 끈다(선후 없음). */
const toggleFlag = (flags, key, axis) => {
  if (key == null) return [...flags];
  const manual = axis.rungs[0].key;
  if (key === manual) return [];
  const implies = axis.implies || {};
  let next;
  if (flags.includes(key)) {
    // 끈다 — 이것을 품는 항목(완전 대체)도 같이 꺼진다. 다 켜진 채 하나만 빠질 수는 없으니까.
    next = flags.filter(f => f !== key && !(implies[f] || []).includes(key));
  } else {
    next = [...flags, key, ...(implies[key] || [])];      // 켠다 — 품는 항목이 있으면 같이 켠다
  }
  // 정해진 순서로 — 서버도 그렇게 저장하지만, 보낸 것과 저장된 것이 같아야 읽기 쉽다.
  return axis.rungs.slice(1).map(r => r.key).filter(k => next.includes(k));
};
const flagLabels = (axis, flags) => (flags && flags.length
  ? axis.rungs.filter(r => flags.includes(r.key)).map(r => r.label).join(' · ')
  : axis.rungs[0].label);

// 껍데기(읽기·모달)와 속(PairPanel)을 가른다 — 속은 props 만 받아 시험·SSR 로 그릴 수 있다.
const PairModal = ({ pairId, axes, onClose, onChanged }) => {
  const [pair, setPair] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const res = await maturityApi.getPair(pairId);
      setPair(res.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, [pairId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <PairPanel pair={pair} pairId={pairId} axes={axes} loadError={error}
                   onClose={onClose} onSaved={(data) => { setPair(p => ({ ...p, ...data })); if (onChanged) onChanged(); }} />
      </Panel>
    </Backdrop>
  );
};

export const PairPanel = ({ pair, pairId, axes, loadError, onClose, onSaved }) => {
  const [editing, setEditing] = useState(null);   // { axis, rung?, value?, note, evidence }
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // 칸의 도달 시점을 그 자리에서 고친다 — { axis, rung, month }. 한 평가에 시점 하나면
  // 거슬러 온 이력을 넣으려면 칸마다 저장을 되풀이해야 해서(2026-08-28).
  const [dating, setDating] = useState(null);
  // 이력은 머리의 ⓘ 단추로 여닫는다 — 아래에 늘 펼쳐 두면 사다리 자리를 먹는다(2026-08-28).
  const [histOpen, setHistOpen] = useState(false);
  const removeEntry = async (changeId) => {
    if (!window.confirm('이 정확도 줄을 지울까요? 남은 줄 가운데 가장 늦은 것이 현재가 됩니다.')) return;
    setBusy(true);
    try {
      const res = await maturityApi.deleteChange(pairId, changeId);
      onSaved(res.data); setSaveError(null);
    } catch (e) { setSaveError(e.message); }
    finally { setBusy(false); }
  };
  const saveReached = async () => {
    if (!dating?.month) return;
    setBusy(true);
    try {
      const res = await maturityApi.setReached(pairId, dating.axis, dating.rung, dating.month);
      onSaved(res.data); setDating(null); setSaveError(null);
    } catch (e) { setSaveError(e.message); }
    finally { setBusy(false); }
  };
  const error = saveError || loadError;

  const canEdit = pair && !pair.deny_reason;
  const phenomena = pair?.phenomena || [];

  const startEdit = (axis, rungKey) => {
    if (!canEdit) return;
    const cur = pair.assessments?.[axis.key];
    // ⚠️ 근거는 **기존 것을 채워서** 연다(2026-08-28). 비워서 열면 위에 글자로만 남고 칸은 비어
    //    「안 적힌 것」처럼 보인다. 고치지 않고 저장하면 같은 근거가 다시 저장될 뿐이다.
    setEditing({
      axis: axis.key,
      kind: axis.kind,
      rung: axis.kind === 'rung' ? rungKey : undefined,
      flags: axis.kind === 'set' ? toggleFlag(cur?.flags || [], rungKey, axis) : undefined,
      value: axis.kind === 'value' ? (cur?.value ?? '') : undefined,
      note: cur?.note || '',
      evidence: { ...(cur?.evidence || {}) },
      // 평가 시점 — 기존 것이 있으면 그 달, 없으면 이번 달. 옛 자료를 넣을 때 고친다.
      assessed_at: thisMonth(),
    });
  };

  const histCount = (pair?.changes || []).filter(c => axes.find(x => x.key === c.axis)?.kind !== 'value').length;

  const save = async () => {
    if (!editing?.note?.trim()) return;
    setBusy(true);
    try {
      // 시점은 값 축에서만 같이 간다 — 칸·묶음 축은 칸 밑에서 따로 고친다(옛 달이 새 이력에 묻으면 안 된다).
      const payload = { note: editing.note, evidence: editing.evidence, assessed_at: editing.kind === 'value' ? (editing.assessed_at || undefined) : undefined };
      if (editing.kind === 'value') payload.value = Number(editing.value);
      else if (editing.kind === 'set') payload.flags = editing.flags;
      else payload.rung = editing.rung;
      const res = await maturityApi.assess(pairId, editing.axis, payload);
      onSaved(res.data);
      setEditing(null);
      setSaveError(null);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const evidenceFields = useMemo(() => ({
    compared_tests: { label: '비교 시험 건수', type: 'number' },
    error_pct: { label: '오차(%)', type: 'number' },
    attachment: { label: '첨부/링크', type: 'text' },
    hours_per_run: { label: '1회 소요(Hr)', type: 'number' },
    tests_saved_per_year: { label: '줄어든 시험 횟수/년', type: 'number' },
  }), []);

  return (
    <>
        <Head>
          <div>
            <Title>
              {pair ? `${pair.subject.name} × ${pair.agent?.name ?? '(수단 없음)'}` : '불러오는 중…'}
            </Title>
            {pair && (
              <Sub>{(pair.agent?.tools || []).length > 0 ? pair.agent.tools.join(', ') : '\u00a0'}</Sub>
            )}
          </div>
          {pair && (
            <HistBtn type="button" $on={histOpen} onClick={() => setHistOpen(o => !o)} aria-expanded={histOpen} aria-label="이력"
                     title={histOpen ? '이력 닫기' : '이력 — 언제 누가 무엇을 바꿨나'}>
              <History size={15} /> {histCount}
            </HistBtn>
          )}
          <CloseButton onClick={onClose} title="닫기"><X size={18} /></CloseButton>
        </Head>
        {pair && histOpen && (
          <HistPanel>
            <AxisHead><History size={14} /> <AxisName>이력</AxisName><AxisQ>정확도 줄은 정확도 축 안에서 봅니다.</AxisQ></AxisHead>
            {(pair.changes || []).filter(c => axes.find(x => x.key === c.axis)?.kind !== 'value').length === 0 ? (
              <AxisQ>아직 바뀐 것이 없습니다.</AxisQ>
            ) : (
              <HistoryList>
                {pair.changes.filter(c => axes.find(x => x.key === c.axis)?.kind !== 'value').map(c => {
                  const axis = axes.find(x => x.key === c.axis);
                  const lab = (k) => {
                    if (!k) return '—';
                    if (axis?.kind === 'set') return flagLabels(axis, String(k).split(',').filter(x => x !== 'manual' && x));
                    return axis?.rungs.find(r => r.key === k)?.label || k;
                  };
                  return (
                    <HistoryRow key={c.id}>
                      <When>{fmtDate(c.created_at)}</When>
                      <span><strong>{axis?.label || c.axis}</strong> {lab(c.before)} → {lab(c.after)}</span>
                      <span style={{ color: '#94a3b8' }}>{c.actor_name}</span>
                      {c.note && <span>“{c.note}”</span>}
                    </HistoryRow>
                  );
                })}
              </HistoryList>
            )}
          </HistPanel>
        )}

        <Body>
          {error && <Notice $bad><AlertTriangle size={14} /> <span>{error}</span></Notice>}
          {pair?.deny_reason && (
            <Notice><AlertTriangle size={14} /> <span>{pair.deny_reason} 조회는 그대로 하실 수 있습니다.</span></Notice>
          )}

          {pair && axes.map(axis => {
            const a = pair.assessments?.[axis.key];
            const dates = reachedDates(pair.changes, axis);
            const curIdx = a?.rung_index ?? null;
            const isEditing = editing?.axis === axis.key;
            return (
              <AxisBlock key={axis.key}>
                <AxisHead>
                  <AxisName>{axis.label}</AxisName>
                  <AxisQ>{axis.question}</AxisQ>
                  {a ? (
                    <Meta>
                      {axis.kind === 'value' && <strong>{a.value}%</strong>}{' '}
                      {fmtDate(a.assessed_at)} · {a.assessed_by_name || '—'}
                      {a.stale && <> <Stale>낡음</Stale></>}
                    </Meta>
                  ) : <Meta>미평가</Meta>}
                </AxisHead>

                {axis.kind === 'set' ? (
                  // 묶음 — 선후 없음. 켠 항목은 채움, 「수동」은 아무것도 안 켰을 때 채움.
                  // 색은 켠 개수(서열)로 — 다 켜면 가장 진하다. 편집 중엔 초안의 묶음을 그린다.
                  (() => {
                    const flags = isEditing ? editing.flags : (a?.flags || null);
                    const n = flags ? flags.length : null;
                    const color = colorFor(n, axis.rungs.length);
                    return (
                      <Ladder>
                        {axis.rungs.map((r, i) => {
                          if (i === 0 && axis.hide_empty) return null;      // 「없음」 칸은 안 보인다 — 다 끄면 그 상태
                          const on = flags != null && (i === 0 ? flags.length === 0 : flags.includes(r.key));
                          return (
                            <Rung key={r.key} role="button" tabIndex={0}
                                  $current={on} $reached={on} $color={i === 0 ? '#e2e8f0' : color} $dark={i !== 0 && isDark(color)}
                                  $editable={canEdit}
                                  title={`${r.description}${isEditing ? ' — 누르면 켜고 끕니다' : ''}`}
                                  onClick={() => {
                                    if (!canEdit) return;
                                    if (isEditing) setEditing(s => ({ ...s, flags: toggleFlag(s.flags, r.key, axis) }));
                                    else startEdit(axis, r.key);
                                  }}>
                              <RungLabel>{i === 0 ? r.label : (on ? '✓ ' : '') + r.label}</RungLabel>
                              {i !== 0 && (
                                <ReachedAt axis={axis} rung={r} reached={on && !isEditing} canEdit={canEdit}
                                           date={dates[r.key]} dating={dating} setDating={setDating} save={saveReached} busy={busy} />
                              )}
                            </Rung>
                          );
                        })}
                      </Ladder>
                    );
                  })()
                ) : axis.kind === 'value' ? (
                  <AccuracyBar axis={axis} a={a} rule={pair.accuracy_rule || DEFAULT_RULE} />
                ) : (
                <Ladder>
                  {axis.rungs.map((r, i) => {
                    const reached = curIdx != null && i <= curIdx;
                    const color = colorFor(i, axis.rungs.length);
                    return (
                      <Rung key={r.key} role="button" tabIndex={0}
                            $current={i === curIdx} $reached={reached} $color={color} $dark={isDark(color)}
                            $editable={canEdit && axis.kind === 'rung'}
                            title={r.description}
                            onClick={() => axis.kind === 'rung' && startEdit(axis, r.key)}>
                        <RungLabel>{r.label}</RungLabel>
                        <ReachedAt axis={axis} rung={r} reached={reached} canEdit={canEdit && axis.kind === 'rung'}
                                   date={dates[r.key]} dating={dating} setDating={setDating} save={saveReached} busy={busy} />
                      </Rung>
                    );
                  })}
                </Ladder>
                )}

                {a && (
                  <Note>
                    <strong>근거</strong> {a.note}
                    {axis.key === 'modeling' && (a.evidence?.phenomena || []).length > 0 && (
                      <> · {a.evidence.phenomena.map(t => <Tag key={t}>{t}</Tag>)}</>
                    )}
                    {Object.entries(a.evidence || {})
                      .filter(([k]) => evidenceFields[k])
                      .map(([k, v]) => <span key={k}> · {evidenceFields[k].label} {v}</span>)}
                  </Note>
                )}

                {axis.kind === 'value' && (
                  <Entries entries={(pair.changes || []).filter(c => c.axis === axis.key)}
                           canEdit={canEdit} busy={busy} onRemove={removeEntry} />
                )}
                {canEdit && axis.kind === 'value' && !isEditing && (
                  <Row style={{ marginTop: '0.5rem' }}>
                    <Button onClick={() => startEdit(axis)}>줄 추가</Button>
                    <AxisQ>저장마다 한 줄이 쌓입니다 — 가장 늦은 달이 현재, 칸은 값에서(사업부 문턱)</AxisQ>
                  </Row>
                )}

                {isEditing && (
                  <Editor>
                    {editing.kind === 'value' ? (
                      <Row>
                        <span style={{ fontSize: '0.8125rem' }}>정확도(%)</span>
                        <Input type="number" min="0" max="100" step="0.1" $w="7rem"
                               value={editing.value}
                               onChange={e => setEditing(s => ({ ...s, value: e.target.value }))}
                               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
                      </Row>
                    ) : editing.kind === 'set' ? (
                      <Row><span style={{ fontSize: '0.8125rem' }}>
                        → <strong>{flagLabels(axis, editing.flags)}</strong>
                        <AxisQ style={{ marginLeft: '0.5rem' }}>위 칸을 눌러 켜고 끕니다.{!axis.hide_empty && <> 「{axis.rungs[0].label}」은 전부 끕니다.</>}{axis.implies?.full && <> 「완전 대체」를 켜면 나머지가 다 켜집니다.</>}</AxisQ>
                      </span></Row>
                    ) : (
                      <Row><span style={{ fontSize: '0.8125rem' }}>
                        → <strong>{axis.rungs.find(r => r.key === editing.rung)?.label}</strong>
                      </span></Row>
                    )}
                    <Row>
                      <Input $grow placeholder="근거 — 무엇을 보고 이렇게 매겼는지 한 줄 (필수)"
                             value={editing.note}
                             onChange={e => setEditing(s => ({ ...s, note: e.target.value }))}
                             onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
                    </Row>
                    <Row>
                      {editing.kind === 'value' && (
                        <label style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          평가 시점{' '}
                          <Input type="month" $w="9rem" max={thisMonth()} value={editing.assessed_at}
                                 onChange={e => setEditing(s => ({ ...s, assessed_at: e.target.value }))}
                                 title="옛 자료면 그 달로" />
                        </label>
                      )}
                      {(axis.evidence || []).filter(k => evidenceFields[k]).map(k => (
                        <label key={k} style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {evidenceFields[k].label}{' '}
                          <Input type={evidenceFields[k].type} $w="8rem"
                                 value={editing.evidence[k] ?? ''}
                                 onChange={e => setEditing(s => ({
                                   ...s, evidence: { ...s.evidence, [k]: e.target.value },
                                 }))} />
                        </label>
                      ))}
                      {axis.key === 'modeling' && (
                        <label style={{ fontSize: '0.75rem', color: '#64748b', flex: 1 }}>
                          예측 가능한 현상 (쉼표로 여럿){' '}
                          <Input $grow list={`phen-${pairId}`}
                                 value={(editing.evidence.phenomena || []).join(', ')}
                                 onChange={e => setEditing(s => ({
                                   ...s, evidence: { ...s.evidence, phenomena: e.target.value.split(',').map(x => x.trim()).filter(Boolean) },
                                 }))} />
                          <datalist id={`phen-${pairId}`}>
                            {phenomena.map(t => <option key={t} value={t} />)}
                          </datalist>
                        </label>
                      )}
                    </Row>
                    <Row>
                      <Primary disabled={busy || !editing.note.trim()
                        || (editing.kind === 'value' && editing.value === '')} onClick={save}>
                        <Check size={13} /> {busy ? '담는 중…' : '저장'}
                      </Primary>
                      <Button onClick={() => setEditing(null)}>취소</Button>
                      {/* ⚠️ 왜 안 되는지는 단추 옆에서 말한다. 패널 맨 위의 알림은 아래 축을 고칠 때 화면 밖이다(2026-08-28). */}
                      {!editing.note.trim() && <AxisQ>근거를 적어야 저장됩니다.</AxisQ>}
                      {editing.note.trim() && editing.kind === 'value' && editing.value === '' && <AxisQ>값을 적어야 저장됩니다.</AxisQ>}
                      {saveError && <Notice $bad style={{ flexBasis: '100%' }}><AlertTriangle size={14} /> <span>{saveError}</span></Notice>}
                    </Row>
                  </Editor>
                )}
              </AxisBlock>
            );
          })}

        </Body>
    </>
  );
};

export default PairModal;
