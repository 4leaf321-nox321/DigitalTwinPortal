import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Check, AlertTriangle, Settings as Cog } from 'lucide-react';
import maturityApi from '../../services/maturityApi';

// 설정 — 정확도 문턱과 경계(2026-08-28). 사무국·관리자만 연다(헤더 단추가 그렇게 나온다).
//
// 왼쪽은 전사 기본('*')과 사업부, 오른쪽은 그 줄의 규칙. 사업부에 값이 없으면 전사 기본을
// 따르고, 전사 기본도 없으면 코드의 기본(70 · 90 · ≥)이다. 저장은 `accuracy` 키 한 판을
// 통째로 보낸다 — 서버가 읽을 때 검사하므로(get_accuracy_rule) 깨진 값은 기본으로 돌아간다.

const Backdrop = styled.div`
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 60;
`;
const Box = styled.div`
  width: min(56rem, 94vw); max-height: 88vh; display: flex; flex-direction: column; background: white; border-radius: 0.75rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3); overflow: hidden;
`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.9rem 1.1rem; border-bottom: 1px solid #e2e8f0;`;
const Title = styled.h3`margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b; flex: 1;`;
const IconBtn = styled.button`border: none; background: transparent; color: #64748b; cursor: pointer; padding: 0.25rem; border-radius: 0.3rem; &:hover { background: #f1f5f9; }`;
const Body = styled.div`display: flex; flex: 1; min-height: 0;`;
const Left = styled.div`width: 15rem; border-right: 1px solid #e2e8f0; overflow: auto; background: #f8fafc;`;
const Item = styled.button`
  display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; border: none; font-family: inherit; cursor: pointer;
  padding: 0.55rem 0.9rem; font-size: 0.8125rem; color: #1e293b; background: ${p => (p.$on ? '#dbeafe' : 'transparent')};
  &:hover { background: ${p => (p.$on ? '#dbeafe' : '#eef2f7')}; }
`;
const Tag = styled.span`font-size: 0.6875rem; color: ${p => (p.$own ? '#1d4ed8' : '#94a3b8')};`;
const Right = styled.div`flex: 1; padding: 1rem 1.25rem; overflow: auto; display: flex; flex-direction: column; gap: 0.9rem;`;
const Field = styled.label`display: flex; align-items: center; gap: 0.6rem; font-size: 0.8125rem; color: #334155; flex-wrap: wrap;`;
const Num = styled.input`width: 5.5rem; padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem;`;
const Hint = styled.div`font-size: 0.75rem; color: #64748b; line-height: 1.5;`;
const Bar = styled.div`display: flex; height: 1.6rem; border-radius: 0.4rem; overflow: hidden; border: 1px solid #cbd5e1; font-size: 0.6875rem; font-weight: 600;`;
const Seg = styled.div`display: flex; align-items: center; justify-content: center; color: ${p => (p.$dark ? 'white' : '#1e293b')}; background: ${p => p.$bg}; min-width: 0; overflow: hidden; white-space: nowrap;`;
const Foot = styled.div`display: flex; gap: 0.5rem; align-items: center; padding: 0.7rem 1.1rem; border-top: 1px solid #e2e8f0; background: #f8fafc;`;
const Button = styled.button`
  padding: 0.4rem 0.9rem; border: 1px solid ${p => (p.$primary ? '#1d4ed8' : '#cbd5e1')}; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  background: ${p => (p.$primary ? '#1d4ed8' : 'white')}; color: ${p => (p.$primary ? 'white' : '#475569')}; display: inline-flex; gap: 0.3rem; align-items: center;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const Notice = styled.div`display: flex; gap: 0.4rem; align-items: flex-start; font-size: 0.8125rem; color: ${p => (p.$bad ? '#991b1b' : '#92400e')};`;

const DIVS = '__divisions__';
const STALE = '__stale__';   // 재평가 기간(일) — 이 날이 지난 평가는 「재평가 필요」
const SECS = '__sectors__';  // 부문 표시 — 체크한 부문은 헤더 토글에서 사라진다(2026-08-29)
const Sep = styled.div`font-size: 0.6875rem; font-weight: 700; color: #94a3b8; padding: 0.6rem 0.9rem 0.2rem; border-top: 1px solid #e2e8f0; margin-top: 0.3rem;`;
const DivList = styled.div`
  display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.8125rem; color: #1e293b;
  label { display: flex; align-items: center; gap: 0.5rem; } small { color: #94a3b8; }
`;
export const DEFAULT_RULE = { thresholds: [{ rung: 'trend', min: 0 }, { rung: 'quantitative', min: 70 }, { rung: 'correlated', min: 90 }], boundary: 'gte' };
const SEG_COLORS = ['#dbeafe', '#93c5fd', '#1d4ed8'];

/** 저장된 판(accuracy 키)에서 한 줄을 읽는다 — 없으면 null. */
const rowOf = (conf, key) => {
  const r = conf?.[key];
  if (!r || !Array.isArray(r.thresholds)) return null;
  const m = Object.fromEntries(r.thresholds.map(t => [t.rung, Number(t.min)]));
  return { q: m.quantitative ?? 70, c: m.correlated ?? 90, boundary: r.boundary === 'gt' ? 'gt' : 'gte' };
};

/** 세 영역 미리보기 — 설정 창과 연계 상세가 같은 그림을 쓴다. */
export const AccuracyPreview = ({ q, c, boundary, rungs, value = null }) => {
  const segs = [[0, q], [q, c], [c, 100]];
  const label = (i) => rungs?.[i]?.label || ['경향 일치', '원인 분석', '현상 재현'][i];
  const sign = boundary === 'gt' ? '>' : '≥';
  return (
    <Bar title={value != null ? `${value}%` : undefined}>
      {segs.map(([a, b], i) => (
        <Seg key={i} $bg={SEG_COLORS[i]} $dark={i === 2} style={{ flex: `${Math.max(b - a, 0)} 0 0` }}
             title={`${label(i)} — ${i === 0 ? '0' : `${sign} ${a}`}${i < 2 ? ` ~ ${b}` : ''}%`}>
          {label(i)}{i > 0 && <span style={{ opacity: 0.75, marginLeft: '0.3rem' }}>{sign}{a}</span>}
        </Seg>
      ))}
    </Bar>
  );
};

const SettingsModal = ({ divisions = [], sectors = [], accuracyRungs = [], onClose, onChanged }) => {
  const [conf, setConf] = useState(null);         // 서버의 accuracy 판 전체
  const [key, setKey] = useState('*');
  const [draft, setDraft] = useState(null);       // { q, c, boundary } | null(전사 기본을 따름)
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  // 사업부 표시 — SR·GTR·CS 처럼 사업부가 아닌 조직을 이 화면에서 뺀다. 전체 목록은 ?all=1 로 받는다.
  const [allDivisions, setAllDivisions] = useState(null);
  const [hidden, setHidden] = useState([]);
  const [hiddenSectors, setHiddenSectors] = useState([]);          // 감춘 부문(2026-08-29)
  const [hiddenSectorsSaved, setHiddenSectorsSaved] = useState([]);           // 초안
  const [hiddenSaved, setHiddenSaved] = useState([]); // 서버 값
  const [staleDays, setStaleDays] = useState('');     // 초안(일)
  const [staleSaved, setStaleSaved] = useState(null);

  useEffect(() => {
    maturityApi.getSettings().then(r => {
      setConf(r.data?.accuracy || {});
      const h = (r.data?.hidden_divisions || []).map(Number);
      setHidden(h); setHiddenSaved(h);
      const sd = r.data?.stale_days ?? 365;
      setStaleDays(String(sd)); setStaleSaved(sd);
      const hs = r.data?.hidden_sectors || [];
      setHiddenSectors(hs); setHiddenSectorsSaved(hs);
    }).catch(e => setError(e.message));
    maturityApi.getDivisions(true).then(r => setAllDivisions(r.data || [])).catch(() => setAllDivisions([]));
  }, []);
  const hiddenChanged = JSON.stringify([...hidden].sort()) !== JSON.stringify([...hiddenSaved].sort());
  const sectorsChanged = JSON.stringify([...hiddenSectors].sort()) !== JSON.stringify([...hiddenSectorsSaved].sort());
  const staleValid = Number.isInteger(Number(staleDays)) && Number(staleDays) >= 1 && Number(staleDays) <= 3650;
  const staleChanged = staleValid && Number(staleDays) !== staleSaved;
  const toggleHidden = (id) => { setSaved(false); setHidden(h => (h.includes(id) ? h.filter(x => x !== id) : [...h, id])); };
  const toggleSector = (k) => { setSaved(false); setHiddenSectors(h => (h.includes(k) ? h.filter(x => x !== k) : [...h, k])); };
  useEffect(() => { if (conf) setDraft(rowOf(conf, key)); }, [conf, key]);   // 「저장됨」은 줄을 옮길 때만 지운다

  const base = useMemo(() => rowOf(conf, '*') || { q: 70, c: 90, boundary: 'gte' }, [conf]);
  const eff = draft || base;                       // 화면에 그릴 규칙 — 줄이 없으면 물려받은 것
  const valid = eff.q > 0 && eff.c > eff.q && eff.c <= 100;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const next = { ...conf };
      if (draft) next[key] = { boundary: draft.boundary, thresholds: [
        { rung: 'trend', min: 0 }, { rung: 'quantitative', min: Number(draft.q) }, { rung: 'correlated', min: Number(draft.c) }] };
      else delete next[key];
      const payload = key === DIVS ? { hidden_divisions: hidden }
        : key === STALE ? { stale_days: Number(staleDays) }
        : key === SECS ? { hidden_sectors: hiddenSectors }
        : { accuracy: next };
      const r = await maturityApi.putSettings(payload);
      if (key === DIVS) { const h = (r.data?.hidden_divisions || hidden).map(Number); setHidden(h); setHiddenSaved(h); }
      else if (key === STALE) { const sd = r.data?.stale_days ?? Number(staleDays); setStaleDays(String(sd)); setStaleSaved(sd); }
      else if (key === SECS) { const hs = r.data?.hidden_sectors || hiddenSectors; setHiddenSectors(hs); setHiddenSectorsSaved(hs); }
      else setConf(r.data?.accuracy || next);
      setSaved(true);
      if (onChanged) onChanged();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const rows = [{ key: '*', name: '전사 기본' }, ...divisions.map(d => ({ key: String(d.id), name: d.name }))];
  const onDivs = key === DIVS;
  const onStale = key === STALE;
  const onSecs = key === SECS;
  const own = (k) => !!rowOf(conf, k);
  const set = (patch) => { setSaved(false); setDraft(d => ({ ...(d || base), ...patch })); };

  return (
    <Backdrop onClick={onClose}>
      <Box onClick={e => e.stopPropagation()} role="dialog" aria-label="설정">
        <Head><Cog size={16} color="#1d4ed8" /><Title>설정 — {onDivs ? '사업부 표시' : onStale ? '재평가 기간' : onSecs ? '부문 표시' : '정확도 문턱과 경계'}</Title><IconBtn onClick={onClose} title="닫기"><X size={16} /></IconBtn></Head>
        <Body>
          <Left>
            <Item type="button" $on={onDivs} onClick={() => { setKey(DIVS); setSaved(false); }}>
              <span>사업부 표시</span>
              <Tag $own={hidden.length > 0}>{hidden.length ? `${hidden.length}개 뺌` : '전부'}</Tag>
            </Item>
            <Item type="button" $on={onSecs} onClick={() => { setKey(SECS); setSaved(false); }}>
              <span>부문 표시</span>
              <Tag $own={hiddenSectors.length > 0}>{hiddenSectors.length ? `${hiddenSectors.length}개 뺌` : '전부'}</Tag>
            </Item>
            <Item type="button" $on={onStale} onClick={() => { setKey(STALE); setSaved(false); }}>
              <span>재평가 기간</span>
              <Tag $own={staleSaved != null && staleSaved !== 365}>{staleSaved != null ? `${staleSaved}일` : '…'}</Tag>
            </Item>
            <Sep>정확도 문턱</Sep>
            {rows.map(r => (
              <Item key={r.key} type="button" $on={key === r.key} onClick={() => { setKey(r.key); setSaved(false); }}>
                <span>{r.name}</span>
                <Tag $own={own(r.key)}>{r.key === '*' ? (own('*') ? '설정됨' : '코드 기본') : (own(r.key) ? '따로' : '전사 따름')}</Tag>
              </Item>
            ))}
          </Left>
          <Right>
            {!conf && !error && <Hint>불러오는 중…</Hint>}
            {conf && onSecs && (
              <>
                <Hint>체크한 부문은 **헤더의 부문 토글에서 사라집니다.** 아직 안 쓰는 부문을 빼 두세요 — 자료는 지워지지 않고, 다시 켜면 그대로 보입니다. 보고 있던 부문을 감추면 시뮬레이션으로 돌아갑니다.</Hint>
                <DivList>
                  {(sectors || []).map(x => (
                    <label key={x.key}>
                      <input type="checkbox" checked={hiddenSectors.includes(x.key)} onChange={() => toggleSector(x.key)} aria-label={`${x.label} 감춤`} />
                      {x.label}
                      {!x.active && <small> — 사다리 없음(준비 중)</small>}
                      {hiddenSectors.includes(x.key) && <small> — 감춤</small>}
                    </label>
                  ))}
                </DivList>
              </>
            )}
            {conf && onDivs && (
              <>
                <Hint>체크한 조직은 이 화면(왼쪽 위 사업부 줄·전체 판·설정의 문턱 목록)에서 빠집니다. SR·GTR·CS 처럼 사업부가 아닌 조직을 빼 두세요. 자료는 지워지지 않습니다.</Hint>
                {allDivisions == null ? <Hint>불러오는 중…</Hint> : (
                  <DivList>
                    {allDivisions.map(d => (
                      <label key={d.id}>
                        <input type="checkbox" checked={hidden.includes(d.id)} onChange={() => toggleHidden(d.id)} aria-label={`${d.name} 제외`} />
                        {d.name}{hidden.includes(d.id) && <small> — 제외</small>}
                      </label>
                    ))}
                  </DivList>
                )}
              </>
            )}
            {conf && onStale && (
              <>
                <Hint>평가한 날로부터 이 날수가 지나면 그 평가는 <strong>재평가 필요</strong>로 표시됩니다 — 배지, 「재평가 필요만」 필터, 요약의 셈이 모두 이 값을 씁니다. 바꾸면 이미 매긴 평가에도 바로 적용됩니다(지우지 않습니다). 기본 365일.</Hint>
                <Field>
                  <span style={{ minWidth: '7rem' }}>재평가 기간</span>
                  <Num type="number" min="1" max="3650" step="1" value={staleDays} aria-label="재평가 기간(일)" onChange={e => { setSaved(false); setStaleDays(e.target.value); }} /> 일
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{staleValid ? `≈ ${Math.round((Number(staleDays) / 30.4) * 10) / 10}개월` : ''}</span>
                </Field>
                <Field>
                  <span style={{ minWidth: '7rem' }}>빠른 선택</span>
                  {[90, 180, 365, 730].map(d => <Button key={d} type="button" onClick={() => { setSaved(false); setStaleDays(String(d)); }}>{d}일</Button>)}
                </Field>
                {!staleValid && <Notice $bad><AlertTriangle size={14} /> <span>1 ~ 3650 사이의 정수(일)여야 합니다.</span></Notice>}
              </>
            )}
            {conf && !onDivs && !onStale && (
              <>
                <Hint>
                  {key === '*' ? '사업부에 따로 정한 값이 없을 때 쓰는 전사 기본입니다.'
                    : (draft ? '이 사업부만의 값입니다. 「전사 기본 따르기」를 누르면 지웁니다.' : '지금은 전사 기본을 따릅니다. 값을 고치면 이 사업부만의 값이 됩니다.')}
                  {' '}값은 시뮬레이션 정확도(%)이고, 칸은 이 문턱으로 정해집니다 — 바꾸면 이미 매긴 정확도의 칸도 같이 바뀝니다.
                </Hint>
                <AccuracyPreview q={Number(eff.q)} c={Number(eff.c)} boundary={eff.boundary} rungs={accuracyRungs} />
                <Field>
                  <span style={{ minWidth: '7rem' }}>원인 분석 문턱</span>
                  <Num type="number" min="1" max="99" step="0.1" value={eff.q} aria-label="원인 분석 문턱" onChange={e => set({ q: e.target.value })} /> %
                </Field>
                <Field>
                  <span style={{ minWidth: '7rem' }}>현상 재현 문턱</span>
                  <Num type="number" min="1" max="100" step="0.1" value={eff.c} aria-label="현상 재현 문턱" onChange={e => set({ c: e.target.value })} /> %
                </Field>
                <Field>
                  <span style={{ minWidth: '7rem' }}>경계</span>
                  <label><input type="radio" name="boundary" checked={eff.boundary === 'gte'} onChange={() => set({ boundary: 'gte' })} /> 같으면 위 칸 (≥)</label>
                  <label><input type="radio" name="boundary" checked={eff.boundary === 'gt'} onChange={() => set({ boundary: 'gt' })} /> 같으면 아래 칸 (&gt;)</label>
                </Field>
                <Hint>예: 문턱 90에 값이 정확히 90이면 — ≥ 는 「현상 재현」, &gt; 는 「원인 분석」.</Hint>
                {!valid && <Notice $bad><AlertTriangle size={14} /> <span>원인 분석 문턱 &lt; 현상 재현 문턱 ≤ 100 이어야 합니다.</span></Notice>}
                {error && <Notice $bad><AlertTriangle size={14} /> <span>{error}</span></Notice>}
              </>
            )}
          </Right>
        </Body>
        <Foot>
          {!onDivs && !onStale && key !== '*' && draft && <Button type="button" onClick={() => { setDraft(null); setSaved(false); }}>전사 기본 따르기</Button>}
          <span style={{ flex: 1, fontSize: '0.75rem', color: '#16a34a' }}>{saved ? '저장됨' : ''}</span>
          <Button type="button" onClick={onClose}>닫기</Button>
          <Button type="button" $primary disabled={busy || !conf || (onDivs ? !hiddenChanged : onStale ? !staleChanged : onSecs ? !sectorsChanged : !valid)} onClick={save}><Check size={14} /> 저장</Button>
        </Foot>
      </Box>
    </Backdrop>
  );
};

export default SettingsModal;
