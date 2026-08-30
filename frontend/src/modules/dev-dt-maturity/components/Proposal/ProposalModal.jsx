import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { X, Check, Ban, AlertTriangle, Bot } from 'lucide-react';
import maturityApi from '../../services/maturityApi';

// 확인 대기 — AI 가 낸 **판단**을 사람이 읽고 승인·거절한다. (2026-08-30)
//
// 왜 있나: 이 모듈이 지키는 한 가지는 「근거 없이는 매기지 않는다」인데, 그 규칙이 막는
// 것은 빈 근거이지 **지어낸 근거**가 아니다. AI 는 그럴듯한 근거를 만들어 내므로 판단은
// 사람이 근거를 읽고 눌러야 판에 오른다.
//
// ⚠️ 대기 중인 제안은 **딴 표에 있다** — 판·요약·변화·모판·추출 어디에도 안 든다.
//    그래서 저 화면들은 이 기능 때문에 아무것도 안 바꿨다.
// ⚠️ 승인하면 **그 사람이 매긴 것**이 된다 — 이력의 actor 는 승인한 사람이다.
//    「AI 가 제안했다」는 제안 표에 남는다.

const Backdrop = styled.div`
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 60;
`;
const Box = styled.div`
  width: min(58rem, 94vw); max-height: 86vh; display: flex; flex-direction: column; background: white; border-radius: 0.75rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3); overflow: hidden;
`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.9rem 1.1rem; border-bottom: 1px solid #e2e8f0;`;
const Title = styled.h3`margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b; flex: 1;`;
const IconBtn = styled.button`border: none; background: transparent; color: #64748b; cursor: pointer; padding: 0.25rem; border-radius: 0.3rem; &:hover { background: #f1f5f9; }`;
const Body = styled.div`padding: 0.9rem 1.1rem; overflow: auto; display: flex; flex-direction: column; gap: 0.75rem;`;
const Why = styled.div`font-size: 0.8125rem; color: #64748b; line-height: 1.6;`;
const Card = styled.div`
  border: 1px solid #e2e8f0; border-left: 3px solid ${p => p.$edge || '#f59e0b'}; border-radius: 0.5rem; padding: 0.7rem 0.85rem;
  display: flex; flex-direction: column; gap: 0.4rem;
`;
const Where = styled.div`font-size: 0.8125rem; color: #1e293b; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;`;
const Ai = styled.span`display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.6875rem; font-weight: 600; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 999px; padding: 0.05rem 0.4rem;`;
const Move = styled.div`
  font-size: 0.8125rem; color: #334155; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  code { background: #f1f5f9; border-radius: 0.25rem; padding: 0.05rem 0.35rem; font-size: 0.75rem; }
  strong { color: #1d4ed8; }
`;
const Note = styled.div`font-size: 0.8125rem; color: #1e293b; background: #f8fafc; border-radius: 0.375rem; padding: 0.45rem 0.6rem; line-height: 1.5;`;
const Small = styled.div`font-size: 0.75rem; color: #94a3b8;`;
const Row = styled.div`display: flex; gap: 0.4rem; align-items: center;`;
const Button = styled.button`
  padding: 0.35rem 0.8rem; border: 1px solid ${p => (p.$primary ? '#166534' : p.$bad ? '#b91c1c' : '#cbd5e1')}; border-radius: 0.375rem;
  font-family: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer; display: inline-flex; gap: 0.3rem; align-items: center;
  background: ${p => (p.$primary ? '#166534' : 'white')}; color: ${p => (p.$primary ? 'white' : p.$bad ? '#b91c1c' : '#475569')};
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const Notice = styled.div`display: flex; gap: 0.4rem; align-items: flex-start; font-size: 0.8125rem; color: #991b1b;`;
const Tabs = styled.div`display: flex; gap: 0.15rem; border-bottom: 1px solid #e2e8f0; flex: none;`;
const Tab = styled.button`
  border: none; background: transparent; font-family: inherit; font-size: 0.8125rem; cursor: pointer; white-space: nowrap;
  padding: 0.45rem 0.8rem; margin-bottom: -1px; border-bottom: 2px solid ${p => (p.$on ? '#1d4ed8' : 'transparent')};
  color: ${p => (p.$on ? '#1d4ed8' : '#64748b')}; font-weight: ${p => (p.$on ? 700 : 500)};
  &:hover { color: #1d4ed8; }
  em { font-style: normal; color: #94a3b8; font-size: 0.6875rem; margin-left: 0.3rem; }
`;
// 지난 것은 테두리 색으로 결말을 말한다 — 승인 초록 · 거절 빨강 · 밀려남 회색
const DONE = {
  approved: ['#166534', '#dcfce7', '승인'],
  rejected: ['#b91c1c', '#fee2e2', '거절'],
  superseded: ['#64748b', '#f1f5f9', '밀려남'],
};
const Verdict = styled.span`
  display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.6875rem; font-weight: 700;
  color: ${p => p.$fg}; background: ${p => p.$bg}; border-radius: 999px; padding: 0.05rem 0.45rem;
`;
const Ok = styled.div`font-size: 0.8125rem; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.375rem; padding: 0.6rem 0.75rem;`;

/** 무엇을 매기자는 것인가 — 사람이 한눈에 읽을 한 줄. */
const what = (p, axes) => {
  const axis = (axes || []).find(a => a.key === p.axis);
  const label = (key) => (axis?.rungs || []).find(r => r.key === key)?.label || key;
  const pay = p.payload || {};
  if (p.kind === 'defect') {
    return `불량 「${pay.name}」 · ${pay.col === 'market' ? '시장' : '시험'} → ${pay.month || '끄기'}`;
  }
  if (p.kind === 'reached') return `「${label(pay.rung)}」 칸에 올라온 때 → ${pay.month}`;
  if (pay.value != null) return `${pay.value}%`;
  if (pay.flags) return (pay.flags || []).map(label).join(' · ');
  return label(pay.rung);
};

const nowText = (p, axes) => {
  const axis = (axes || []).find(a => a.key === p.axis);
  const n = p.now;
  if (!n || (n.rung == null && n.value == null)) return '아직 안 매김';
  if (n.value != null) return `${n.value}%`;
  return String(n.rung).split(',')
    .map(k => (axis?.rungs || []).find(r => r.key === k)?.label || k).join(' · ');
};

const ProposalModal = ({ divisionId, axesBySector = {}, onClose, onChanged }) => {
  const [rows, setRows] = useState(null);
  const [past, setPast] = useState(null);          // 지난 것 — 처음 열 때 함께 받는다
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const [a, b] = await Promise.all([
        maturityApi.listProposals(divisionId, 'pending'),
        maturityApi.listProposals(divisionId, 'done'),
      ]);
      setRows(a.data || []); setPast(b.data || []); setError(null);
    } catch (e) { setError(e.message); setRows([]); setPast([]); }
  };
  useEffect(() => { load(); }, [divisionId]);   // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (row, ok) => {
    // ⚠️ 승인하면 **그 사람이 매긴 것**이 된다 — 근거를 읽었다는 뜻이므로 한 번 묻는다.
    if (ok && !window.confirm(`「${row.subject_name}」의 ${row.axis_label}을(를) 이렇게 매깁니다.\n`
      + `승인하면 ${row.decided_by_name || '내'} 이름으로 판에 오릅니다. 근거를 읽으셨나요?`)) return;
    setBusy(row.id); setError(null);
    try {
      await maturityApi.decideProposal(row.id, ok ? 'approve' : 'reject');
      await load();
      if (onChanged) onChanged();
    } catch (e) { setError(e.message); }
    finally { setBusy(null); }
  };

  return (
    <Backdrop onClick={onClose}>
      <Box onClick={e => e.stopPropagation()} role="dialog" aria-label="확인 대기">
        <Head>
          <Bot size={16} color="#92400e" />
          <Title>확인 대기{rows ? ` — ${rows.length}건` : ''}</Title>
          <IconBtn onClick={onClose} title="닫기"><X size={16} /></IconBtn>
        </Head>
        <Tabs role="tablist" aria-label="확인 대기 갈래">
          <Tab type="button" role="tab" aria-selected={tab === 'pending'} $on={tab === 'pending'}
               onClick={() => setTab('pending')}>대기{rows && <em>{rows.length}</em>}</Tab>
          <Tab type="button" role="tab" aria-selected={tab === 'past'} $on={tab === 'past'}
               onClick={() => setTab('past')}>지난 것{past && <em>{past.length}</em>}</Tab>
        </Tabs>
        <Body>
          {tab === 'past' ? (
            <>
              <Why>
                <strong>무엇을 냈고 우리가 어떻게 했나.</strong> 승인·거절한 것과, 같은 자리에 새 제안이
                와서 <strong>밀려난</strong> 것까지 그대로 남습니다 — 아무도 안 누른 것이라도
                「AI 가 이렇게도 제안했다」는 기록입니다. 여기서는 아무것도 바꿀 수 없습니다.
              </Why>
              {past == null && <Small>불러오는 중…</Small>}
              {past && past.length === 0 && <Ok>아직 지난 것이 없습니다.</Ok>}
              {(past || []).map(p => {
                const axes = axesBySector[p.sector] || [];
                const [fg, bg, label] = DONE[p.status] || ['#64748b', '#f1f5f9', p.status];
                return (
                  <Card key={p.id} $edge={fg}>
                    <Where>
                      {p.subject_name}{p.agent_name ? ` × ${p.agent_name}` : ''}
                      <span style={{ color: '#64748b', fontWeight: 400 }}>· {p.axis_label}</span>
                      <Verdict $fg={fg} $bg={bg}>{label}</Verdict>
                    </Where>
                    <Move><strong>{what(p, axes)}</strong></Move>
                    <Note>{p.note || '(근거 없음)'}</Note>
                    {p.decided_note && <Note style={{ background: '#fff7ed' }}>사유: {p.decided_note}</Note>}
                    <Small>
                      {p.actor_name}(AI) 제안 {String(p.created_at || '').slice(0, 16).replace('T', ' ')}
                      {p.decided_at && ` · ${p.decided_by_name || '—'} ${label} ${String(p.decided_at).slice(0, 16).replace('T', ' ')}`}
                    </Small>
                  </Card>
                );
              })}
            </>
          ) : (
          <>
          <Why>
            AI 가 <strong>매기자고 낸 판단</strong>입니다. <strong>아직 판에 안 올랐습니다</strong> —
            요약·변화·모판·추출 어디에도 들어 있지 않습니다. 근거를 읽고 승인하면 그때 오르고,
            <strong> 승인한 사람이 매긴 것</strong>이 됩니다(이력에 그 이름이 남습니다).
            근거가 미덥지 않으면 거절하세요 — 거절해도 자료는 아무것도 안 바뀝니다.
          </Why>
          {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
          {rows == null && <Small>불러오는 중…</Small>}
          {rows && rows.length === 0 && <Ok>확인할 것이 없습니다.</Ok>}
          {(rows || []).map(p => {
            const axes = axesBySector[p.sector] || [];
            return (
              <Card key={p.id}>
                <Where>
                  {p.subject_name}{p.agent_name ? ` × ${p.agent_name}` : ''}
                  <span style={{ color: '#64748b', fontWeight: 400 }}>· {p.axis_label}</span>
                  <Ai><Bot size={11} /> AI</Ai>
                </Where>
                <Move>
                  <code>{nowText(p, axes)}</code> → <strong>{what(p, axes)}</strong>
                </Move>
                <Note>{p.note || '(근거 없음)'}</Note>
                <Small>{p.actor_name} · {String(p.created_at || '').slice(0, 16).replace('T', ' ')}</Small>
                <Row>
                  <Button $primary disabled={busy === p.id} onClick={() => decide(p, true)}
                          aria-label={`${p.subject_name} ${p.axis_label} 승인`}>
                    <Check size={13} /> 승인
                  </Button>
                  <Button $bad disabled={busy === p.id} onClick={() => decide(p, false)}
                          aria-label={`${p.subject_name} ${p.axis_label} 거절`}>
                    <Ban size={13} /> 거절
                  </Button>
                </Row>
              </Card>
            );
          })}
          </>
          )}
        </Body>
      </Box>
    </Backdrop>
  );
};

export default ProposalModal;
