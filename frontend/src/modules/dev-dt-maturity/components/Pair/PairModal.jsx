import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Check, History, AlertTriangle } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import { colorFor } from '../../utils/board';

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
const Rung = styled.button`
  flex: 1 1 0; min-width: 96px; padding: 0.45rem 0.5rem; border-radius: 0.375rem; text-align: left;
  border: 2px solid ${p => (p.$current ? '#1d4ed8' : '#e2e8f0')};
  background: ${p => (p.$reached ? p.$color : 'white')};
  color: ${p => (p.$reached && p.$dark ? 'white' : '#1e293b')};
  font-family: inherit; font-size: 0.8125rem; cursor: ${p => (p.$editable ? 'pointer' : 'default')};
  opacity: ${p => (p.$editable || p.$reached ? 1 : 0.7)};
  &:hover { border-color: ${p => (p.$editable ? '#1d4ed8' : '#e2e8f0')}; }
`;
const RungLabel = styled.div`font-weight: 700;`;
const RungDate = styled.div`font-size: 0.6875rem; opacity: 0.8; margin-top: 0.1rem;`;
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

const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '');
const isDark = (color) => ['#3b82f6', '#1d4ed8', '#1e3a8a'].includes(color);

/** 이력에서 「이 칸에 언제 올라왔나」. 같은 칸에 여러 번이면 가장 이른 날. */
const reachedDates = (changes, axis) => {
  const out = {};
  (changes || []).filter(c => c.axis === axis.key).forEach(c => {
    const key = c.after;
    if (key && (!out[key] || c.created_at < out[key])) out[key] = c.created_at;
  });
  return out;
};

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
  const error = saveError || loadError;

  const canEdit = pair && !pair.deny_reason;
  const phenomena = pair?.phenomena || [];

  const startEdit = (axis, rungKey) => {
    if (!canEdit) return;
    const cur = pair.assessments?.[axis.key];
    setEditing({
      axis: axis.key,
      kind: axis.kind,
      rung: axis.kind === 'rung' ? rungKey : undefined,
      value: axis.kind === 'value' ? (cur?.value ?? '') : undefined,
      note: '',
      evidence: { ...(cur?.evidence || {}) },
    });
  };

  const save = async () => {
    if (!editing?.note?.trim()) return;
    setBusy(true);
    try {
      const payload = { note: editing.note, evidence: editing.evidence };
      if (editing.kind === 'value') payload.value = Number(editing.value);
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
              <Sub>
                {pair.subject.detail && <>{pair.subject.detail} · </>}
                적용 제품군 {(pair.subject.product_families || []).join(', ') || '—'}
                {pair.agent?.model_kind && <> · 모델 {pair.agent.model_kind}</>}
                {(pair.agent?.tools || []).length > 0 && <> · 도구 {pair.agent.tools.join(', ')}</>}
                {pair.agent?.project_uuid && (
                  <> · <a href={`/digital-twin-dashboard?project=${pair.agent.project_uuid}`} target="_blank" rel="noreferrer">과제 열기</a></>
                )}
              </Sub>
            )}
          </div>
          <CloseButton onClick={onClose} title="닫기"><X size={18} /></CloseButton>
        </Head>

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

                <Ladder>
                  {axis.rungs.map((r, i) => {
                    const reached = curIdx != null && i <= curIdx;
                    const color = colorFor(i, axis.rungs.length);
                    return (
                      <Rung key={r.key} type="button"
                            $current={i === curIdx} $reached={reached} $color={color} $dark={isDark(color)}
                            $editable={canEdit && axis.kind === 'rung'}
                            title={r.description}
                            onClick={() => axis.kind === 'rung' && startEdit(axis, r.key)}>
                        <RungLabel>{r.label}</RungLabel>
                        {dates[r.key] && <RungDate>{fmtDate(dates[r.key])}</RungDate>}
                      </Rung>
                    );
                  })}
                </Ladder>

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

                {canEdit && axis.kind === 'value' && !isEditing && (
                  <Row style={{ marginTop: '0.5rem' }}>
                    <Button onClick={() => startEdit(axis)}>값 적기</Button>
                    <AxisQ>칸은 값에서 정해집니다 — 사업부 문턱 기준</AxisQ>
                  </Row>
                )}

                {isEditing && (
                  <Editor>
                    {editing.kind === 'value' ? (
                      <Row>
                        <span style={{ fontSize: '0.8125rem' }}>정확도(%)</span>
                        <Input type="number" min="0" max="100" step="0.1" $w="7rem"
                               value={editing.value}
                               onChange={e => setEditing(s => ({ ...s, value: e.target.value }))} />
                      </Row>
                    ) : (
                      <Row><span style={{ fontSize: '0.8125rem' }}>
                        → <strong>{axis.rungs.find(r => r.key === editing.rung)?.label}</strong>
                      </span></Row>
                    )}
                    <Row>
                      <Input $grow placeholder="근거 — 무엇을 보고 이렇게 매겼는지 한 줄 (필수)"
                             value={editing.note}
                             onChange={e => setEditing(s => ({ ...s, note: e.target.value }))} />
                    </Row>
                    <Row>
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
                        <Check size={13} /> 저장
                      </Primary>
                      <Button onClick={() => setEditing(null)}>취소</Button>
                    </Row>
                  </Editor>
                )}
              </AxisBlock>
            );
          })}

          {pair && (
            <AxisBlock>
              <AxisHead><History size={14} /> <AxisName>이력</AxisName></AxisHead>
              {(pair.changes || []).length === 0 ? (
                <AxisQ>아직 바뀐 것이 없습니다.</AxisQ>
              ) : (
                <HistoryList>
                  {pair.changes.map(c => {
                    const axis = axes.find(x => x.key === c.axis);
                    const lab = (k) => axis?.rungs.find(r => r.key === k)?.label || k || '—';
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
            </AxisBlock>
          )}
        </Body>
    </>
  );
};

export default PairModal;
