import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Link2, Download, Upload, AlertTriangle, Check } from 'lucide-react';
import maturityApi from '../../services/maturityApi';

// 목록 — 시험·시뮬레이션·쌍을 만들고, 로드맵에서 뽑아 넣는다. (PLAN 6절 · 7-5)
//
// ⚠️ 가져오기는 미리보기 → 넣기 두 단계다. 미리보기는 아무것도 저장하지 않는다.
// ⚠️ 연결을 끊으면 평가·이력이 같이 간다 — 확인 문구에 그 수를 넣는다.

const Wrap = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; @media (max-width: 1100px) { grid-template-columns: 1fr; }`;
const Box = styled.section`border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white; overflow: hidden;`;
const BoxHead = styled.div`
  display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem; background: #f8fafc;
  border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; font-weight: 700; color: #1e293b;
`;
const Count = styled.span`font-size: 0.75rem; color: #94a3b8; font-weight: 400;`;
const List = styled.div`display: flex; flex-direction: column; max-height: 420px; overflow: auto;`;
const Row = styled.div`
  display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.75rem; border-bottom: 1px solid #f1f5f9;
  font-size: 0.8125rem; &:hover { background: #fafafa; }
`;
const Name = styled.span`flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Sub = styled.span`color: #94a3b8; font-size: 0.75rem;`;
const Icon = styled.button`
  border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0.15rem; border-radius: 0.25rem;
  &:hover { color: #b91c1c; background: #fef2f2; } &:disabled { opacity: 0.3; cursor: not-allowed; }
`;
const Form = styled.form`display: flex; gap: 0.4rem; padding: 0.5rem 0.75rem; border-top: 1px solid #e2e8f0; flex-wrap: wrap;`;
const Input = styled.input`
  padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem;
  flex: ${p => (p.$grow ? 1 : 'none')}; min-width: 0; width: ${p => p.$w || 'auto'};
`;
const Select = styled.select`padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem;`;
const Textarea = styled.textarea`
  width: 100%; min-height: 140px; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
  font-family: ui-monospace, monospace; font-size: 0.75rem; box-sizing: border-box;
`;
const Button = styled.button`
  padding: 0.35rem 0.7rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: white; color: #475569;
  font-size: 0.8125rem; font-weight: 600; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;
  &:hover:not(:disabled) { border-color: #1d4ed8; color: #1d4ed8; } &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const Primary = styled(Button)`background: #1d4ed8; border-color: transparent; color: white;`;
const Notice = styled.div`
  display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.6rem 0.75rem; border-radius: 0.5rem; margin: 0.5rem 0.75rem;
  background: ${p => (p.$bad ? '#fef2f2' : p.$ok ? '#f0fdf4' : '#fffbeb')};
  border: 1px solid ${p => (p.$bad ? '#fecaca' : p.$ok ? '#bbf7d0' : '#fde68a')};
  color: ${p => (p.$bad ? '#991b1b' : p.$ok ? '#15803d' : '#92400e')}; font-size: 0.8125rem; line-height: 1.5;
`;
const Body = styled.div`padding: 0.6rem 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8125rem; color: #475569;`;
const Preview = styled.div`max-height: 240px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 0.375rem;`;
const PRow = styled.div`
  display: flex; gap: 0.5rem; padding: 0.3rem 0.5rem; border-bottom: 1px solid #f1f5f9; font-size: 0.75rem;
  color: ${p => (p.$err ? '#991b1b' : '#1e293b')}; background: ${p => (p.$err ? '#fef2f2' : 'white')};
`;

const ListView = ({ divisionId, denyReason, modelKinds, onOpenPair, onChanged }) => {
  const [subjects, setSubjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [error, setError] = useState(null);
  const [newSubject, setNewSubject] = useState({ name: '', detail: '', product_families: '' });
  const [newAgent, setNewAgent] = useState({ name: '', kind: '', model_kind: '' });
  const [link, setLink] = useState({ subject_id: '', agent_id: '' });
  const [reconcile, setReconcile] = useState(null);
  const canEdit = !denyReason;

  const load = async () => {
    try {
      const [s, a, b, r] = await Promise.all([
        maturityApi.listSubjects(divisionId), maturityApi.listAgents(divisionId),
        maturityApi.getBoard(divisionId), maturityApi.reconcile(divisionId),
      ]);
      setSubjects(s.data); setAgents(a.data);
      setPairs(b.data.subjects.flatMap(x => x.pairs));
      setReconcile(r.data);
      setError(null);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { if (divisionId) load(); }, [divisionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = () => { load(); if (onChanged) onChanged(); };
  const run = async (fn) => { try { await fn(); done(); } catch (e) { setError(e.message); } };

  const pairCount = useMemo(() => {
    const bySubject = {}, byAgent = {};
    pairs.forEach(p => { bySubject[p.subject_id] = (bySubject[p.subject_id] || 0) + 1; byAgent[p.agent_id] = (byAgent[p.agent_id] || 0) + 1; });
    return { bySubject, byAgent };
  }, [pairs]);

  return (
    <>
      {error && <Notice $bad><AlertTriangle size={14} /> <span>{error}</span></Notice>}
      {denyReason && <Notice><AlertTriangle size={14} /> <span>{denyReason} 조회는 그대로 하실 수 있습니다.</span></Notice>}
      <Wrap>
        <Box>
          <BoxHead>시험 항목 <Count>{subjects.length}</Count></BoxHead>
          <List>
            {subjects.map(s => (
              <Row key={s.id}>
                <Name title={s.detail || ''}>{s.name} {s.detail && <Sub>{s.detail}</Sub>}</Name>
                <Sub>× {pairCount.bySubject[s.id] || 0}</Sub>
                {(s.product_families || []).length > 0 && <Sub>{s.product_families.join(', ')}</Sub>}
                <Icon disabled={!canEdit} title="지우기 — 걸린 쌍·평가가 같이 사라집니다"
                      onClick={() => window.confirm(`「${s.name}」을 지웁니다. 걸린 쌍 ${pairCount.bySubject[s.id] || 0}개와 그 평가·이력이 같이 사라집니다.`)
                        && run(() => maturityApi.deleteSubject(s.id))}>
                  <Trash2 size={14} />
                </Icon>
              </Row>
            ))}
          </List>
          {canEdit && (
            <Form onSubmit={e => { e.preventDefault(); if (!newSubject.name.trim()) return;
              run(async () => { await maturityApi.createSubject({ division_id: divisionId, ...newSubject }); setNewSubject({ name: '', detail: '', product_families: '' }); }); }}>
              <Input $grow placeholder="시험 항목" value={newSubject.name} onChange={e => setNewSubject(s => ({ ...s, name: e.target.value }))} />
              <Input $w="7rem" placeholder="세부" value={newSubject.detail} onChange={e => setNewSubject(s => ({ ...s, detail: e.target.value }))} />
              <Input $w="9rem" placeholder="제품군 (쉼표)" value={newSubject.product_families} onChange={e => setNewSubject(s => ({ ...s, product_families: e.target.value }))} />
              <Button type="submit"><Plus size={13} /> 추가</Button>
            </Form>
          )}
        </Box>

        <Box>
          <BoxHead>시뮬레이션 <Count>{agents.length}</Count></BoxHead>
          <List>
            {agents.map(a => (
              <Row key={a.id}>
                <Name>{a.name} {a.kind && <Sub>{a.kind}</Sub>}</Name>
                {a.model_kind && <Sub>{modelKinds.find(m => m.key === a.model_kind)?.label || a.model_kind}</Sub>}
                <Sub>× {pairCount.byAgent[a.id] || 0}</Sub>
                <Icon disabled={!canEdit} title="지우기 — 걸린 쌍·평가가 같이 사라집니다"
                      onClick={() => window.confirm(`「${a.name}」을 지웁니다. 걸린 쌍 ${pairCount.byAgent[a.id] || 0}개와 그 평가·이력이 같이 사라집니다.`)
                        && run(() => maturityApi.deleteAgent(a.id))}>
                  <Trash2 size={14} />
                </Icon>
              </Row>
            ))}
          </List>
          {canEdit && (
            <Form onSubmit={e => { e.preventDefault(); if (!newAgent.name.trim()) return;
              run(async () => { await maturityApi.createAgent({ division_id: divisionId, ...newAgent, model_kind: newAgent.model_kind || null }); setNewAgent({ name: '', kind: '', model_kind: '' }); }); }}>
              <Input $grow placeholder="시뮬레이션 (엑셀 행 단위)" value={newAgent.name} onChange={e => setNewAgent(s => ({ ...s, name: e.target.value }))} />
              <Input $w="6rem" placeholder="종류" value={newAgent.kind} onChange={e => setNewAgent(s => ({ ...s, kind: e.target.value }))} />
              <Select value={newAgent.model_kind} onChange={e => setNewAgent(s => ({ ...s, model_kind: e.target.value }))}>
                <option value="">모델 종류</option>
                {modelKinds.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </Select>
              <Button type="submit"><Plus size={13} /> 추가</Button>
            </Form>
          )}
        </Box>

        <Box>
          <BoxHead><Link2 size={14} /> 쌍 (시험 × 시뮬레이션) <Count>{pairs.length}</Count></BoxHead>
          <List>
            {pairs.map(p => (
              <Row key={p.id}>
                <Name>
                  <a href={`?pair=${p.id}`} onClick={e => { e.preventDefault(); onOpenPair(p.id); }}>
                    {p.subject.name} × {p.agent?.name}
                  </a>
                </Name>
                <Sub>{p.unassessed.length ? `미평가 ${p.unassessed.length}` : '전부 매김'}</Sub>
                <Icon disabled={!canEdit} title="연결 끊기 — 평가·이력이 같이 사라집니다"
                      onClick={() => {
                        const n = Object.values(p.assessments).filter(Boolean).length;
                        if (window.confirm(`연결을 끊습니다. 평가 ${n}건과 이력이 같이 사라집니다.`)) run(() => maturityApi.deletePair(p.id));
                      }}>
                  <Trash2 size={14} />
                </Icon>
              </Row>
            ))}
          </List>
          {canEdit && (
            <Form onSubmit={e => { e.preventDefault(); if (!link.subject_id || !link.agent_id) return;
              run(async () => { await maturityApi.createPair(Number(link.subject_id), Number(link.agent_id)); setLink({ subject_id: '', agent_id: '' }); }); }}>
              <Select value={link.subject_id} onChange={e => setLink(l => ({ ...l, subject_id: e.target.value }))}>
                <option value="">시험 항목</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <span>×</span>
              <Select value={link.agent_id} onChange={e => setLink(l => ({ ...l, agent_id: e.target.value }))}>
                <option value="">시뮬레이션</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <Button type="submit"><Link2 size={13} /> 잇기</Button>
            </Form>
          )}
        </Box>

        <ImportBox divisionId={divisionId} canEdit={canEdit} reconcile={reconcile} onDone={done} />
      </Wrap>
    </>
  );
};

// ── 가져오기 — 틀 → 손보기 → 미리보기 → 넣기 ─────────────────────────────
const ImportBox = ({ divisionId, canEdit, reconcile, onDone }) => {
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [withAccuracy, setWithAccuracy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    try {
      const blob = await maturityApi.downloadTemplate(divisionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `maturity_${divisionId}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };
  const doPreview = async () => {
    setBusy(true); setResult(null);
    try { setPreview((await maturityApi.importPreview(divisionId, text)).data); setErr(null); }
    catch (e) { setErr(e.message); setPreview(null); }
    finally { setBusy(false); }
  };
  const doApply = async () => {
    setBusy(true);
    try {
      setResult((await maturityApi.importApply(divisionId, text, withAccuracy, label || null)).data);
      setPreview(null); setErr(null); onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Box>
      <BoxHead><Upload size={14} /> 가져오기</BoxHead>
      <Body>
        <div>
          ① <Button onClick={download}><Download size={13} /> 틀 내려받기</Button>{' '}
          — 로드맵의 시험 항목과 연결 과제를 한 줄씩 뽑은 CSV. 과제 단위로 묶인 것은
          <strong> 시뮬레이션 단위로 쪼개서</strong> 채우세요. ② 엑셀에서 채운 뒤 복사해 아래에 붙입니다.
        </div>
        <Textarea placeholder="엑셀에서 머리글째 복사해 붙여넣기 (탭 구분). 정확도(%) 열은 비워도 됩니다."
                  value={text} onChange={e => setText(e.target.value)} disabled={!canEdit} />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button disabled={!canEdit || !text.trim() || busy} onClick={doPreview}>③ 미리보기</Button>
          <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <input type="checkbox" checked={withAccuracy} onChange={e => setWithAccuracy(e.target.checked)} /> 정확도 열도 넣기
          </label>
          <Input $w="14rem" placeholder="출처 (예: MX_가상검증_2026Q3.xlsx)" value={label} onChange={e => setLabel(e.target.value)} />
          <Primary disabled={!canEdit || !preview || busy || preview.summary.rows === preview.summary.errors} onClick={doApply}>
            <Check size={13} /> ④ 넣기
          </Primary>
        </div>
        {err && <Notice $bad style={{ margin: 0 }}><AlertTriangle size={14} /> <span>{err}</span></Notice>}
        {preview && (
          <>
            <div>
              새 시험 <strong>{preview.summary.new_subjects}</strong> · 새 시뮬레이션 <strong>{preview.summary.new_agents}</strong> ·
              새 쌍 <strong>{preview.summary.new_pairs}</strong> · 이미 있는 쌍 {preview.summary.existing_pairs} ·
              정확도 값 {preview.summary.accuracy_values} · <span style={{ color: preview.summary.errors ? '#b91c1c' : undefined }}>오류 {preview.summary.errors}</span>
              {' '}— 아직 아무것도 저장하지 않았습니다.
            </div>
            <Preview>
              {preview.rows.map(r => (
                <PRow key={r.line} $err={r.status === 'error'}>
                  <span style={{ minWidth: '2.5rem', color: '#94a3b8' }}>{r.line}행</span>
                  <span style={{ flex: 1 }}>{r.subject} × {r.agent}{r.accuracy != null && ` · ${r.accuracy}%`}</span>
                  <span>{r.status === 'error' ? r.errors.join(' / ') : r.status === 'exists' ? '있음' : '새로'}</span>
                </PRow>
              ))}
            </Preview>
          </>
        )}
        {result && (
          <Notice $ok style={{ margin: 0 }}>
            <Check size={14} />
            <span>넣었습니다 — 시험 {result.done.subjects} · 시뮬레이션 {result.done.agents} · 쌍 {result.done.pairs} · 정확도 {result.done.accuracy}
              {result.done.skipped ? ` · 오류라 건너뛴 줄 ${result.done.skipped}` : ''}</span>
          </Notice>
        )}
        {reconcile && (reconcile.missing_here.length > 0 || reconcile.only_here.length > 0) && (
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            로드맵과 어긋남 — 로드맵에는 있는데 여기 없는 시험 <strong>{reconcile.missing_here.length}</strong>
            {reconcile.missing_here.length > 0 && <> ({reconcile.missing_here.slice(0, 6).join(', ')}{reconcile.missing_here.length > 6 ? ' …' : ''})</>}
            {' '}· 여기만 있는 시험 <strong>{reconcile.only_here.length}</strong>. 세기만 합니다 — 맞추라고 강제하지 않습니다.
          </div>
        )}
      </Body>
    </Box>
  );
};

export default ListView;
