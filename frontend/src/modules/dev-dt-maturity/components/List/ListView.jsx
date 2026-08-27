import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Trash2, Link2, AlertTriangle } from 'lucide-react';
import maturityApi from '../../services/maturityApi';

// 목록 — 쌍을 잇는 곳. (PLAN 7-5)
//
// 시험 항목·시뮬레이션의 추가·수정·삭제와 가져오기는 **헤더 단추**가 여는 창에서 한다.
// 이 화면은 하나에 집중한다 — 시험과 시뮬레이션을 잇고, 끊는 것.
//
// ⚠️ 연결을 끊으면 평가·이력이 같이 간다 — 확인 문구에 그 수를 넣는다.

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.75rem; max-width: 980px;`;
const Box = styled.section`border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white; overflow: hidden;`;
const BoxHead = styled.div`
  display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem; background: #f8fafc;
  border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; font-weight: 700; color: #1e293b;
`;
const Count = styled.span`font-size: 0.75rem; color: #94a3b8; font-weight: 400;`;
const Hint = styled.span`margin-left: auto; font-size: 0.75rem; color: #94a3b8; font-weight: 400;`;
const List = styled.div`display: flex; flex-direction: column; max-height: 60vh; overflow: auto;`;
const Row = styled.div`
  display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.75rem; border-bottom: 1px solid #f1f5f9;
  font-size: 0.8125rem; &:hover { background: #fafafa; }
`;
const Name = styled.span`flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Sub = styled.span`color: #94a3b8; font-size: 0.75rem; white-space: nowrap;`;
const Icon = styled.button`
  border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0.15rem; border-radius: 0.25rem;
  &:hover { color: #b91c1c; background: #fef2f2; } &:disabled { opacity: 0.3; cursor: not-allowed; }
`;
const Form = styled.form`display: flex; gap: 0.4rem; padding: 0.5rem 0.75rem; border-top: 1px solid #e2e8f0; flex-wrap: wrap; align-items: center;`;
const Select = styled.select`padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; max-width: 20rem;`;
const Button = styled.button`
  padding: 0.4rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: white; color: #475569;
  font-size: 0.8125rem; font-weight: 600; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;
  &:hover:not(:disabled) { border-color: #1d4ed8; color: #1d4ed8; } &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const Notice = styled.div`
  display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.6rem 0.75rem; border-radius: 0.5rem;
  background: ${p => (p.$bad ? '#fef2f2' : '#fffbeb')}; border: 1px solid ${p => (p.$bad ? '#fecaca' : '#fde68a')};
  color: ${p => (p.$bad ? '#991b1b' : '#92400e')}; font-size: 0.8125rem; line-height: 1.5;
`;
const Foot = styled.div`font-size: 0.75rem; color: #64748b; line-height: 1.5;`;

const ListView = ({ divisionId, denyReason, onOpenPair, onChanged, refreshKey }) => {
  const [subjects, setSubjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [reconcile, setReconcile] = useState(null);
  const [error, setError] = useState(null);
  const [link, setLink] = useState({ subject_id: '', agent_id: '' });
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
  useEffect(() => { if (divisionId) load(); }, [divisionId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => { try { await fn(); load(); if (onChanged) onChanged(); } catch (e) { setError(e.message); } };

  // 이미 이어진 짝은 잇기 목록에서 뺀다 — 서버도 거절하지만 화면이 먼저 말하는 게 낫다.
  const linkedAgents = useMemo(() => new Set(
    pairs.filter(p => String(p.subject_id) === link.subject_id).map(p => p.agent_id)), [pairs, link.subject_id]);

  return (
    <Wrap>
      {error && <Notice $bad><AlertTriangle size={14} /> <span>{error}</span></Notice>}
      {denyReason && <Notice><AlertTriangle size={14} /> <span>{denyReason} 조회는 그대로 하실 수 있습니다.</span></Notice>}

      <Box>
        <BoxHead>
          <Link2 size={14} /> 쌍 — 시험 × 시뮬레이션 <Count>{pairs.length}</Count>
          <Hint>시험 {subjects.length} · 시뮬레이션 {agents.length} — 항목 관리와 가져오기는 위 헤더 단추에서</Hint>
        </BoxHead>
        <List>
          {pairs.length === 0 && <Row><Sub>아직 이어진 쌍이 없습니다. 아래에서 잇거나 헤더의 「가져오기」로 넣으세요.</Sub></Row>}
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
            <Select value={link.subject_id} onChange={e => setLink({ subject_id: e.target.value, agent_id: '' })}>
              <option value="">시험 항목</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <span>×</span>
            <Select value={link.agent_id} onChange={e => setLink(l => ({ ...l, agent_id: e.target.value }))} disabled={!link.subject_id}>
              <option value="">시뮬레이션</option>
              {agents.filter(a => !linkedAgents.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Button type="submit" disabled={!link.subject_id || !link.agent_id}><Link2 size={13} /> 잇기</Button>
          </Form>
        )}
      </Box>

      {reconcile && (reconcile.missing_here.length > 0 || reconcile.only_here.length > 0) && (
        <Foot>
          로드맵과 어긋남 — 로드맵에는 있는데 여기 없는 시험 <strong>{reconcile.missing_here.length}</strong>
          {reconcile.missing_here.length > 0 && <> ({reconcile.missing_here.slice(0, 6).join(', ')}{reconcile.missing_here.length > 6 ? ' …' : ''})</>}
          {' '}· 여기만 있는 시험 <strong>{reconcile.only_here.length}</strong>. 세기만 합니다 — 맞추라고 강제하지 않습니다.
        </Foot>
      )}
    </Wrap>
  );
};

export default ListView;
