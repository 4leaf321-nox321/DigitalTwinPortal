import React, { useEffect, useMemo, useState } from 'react';
import maturityApi from '../../services/maturityApi';
import ItemManagerModal from './ItemManagerModal';
import ImportModal from './ImportModal';

// 헤더 단추가 여는 창 셋(시험 항목 관리 · 시뮬레이션 관리 · 가져오기)의 자료 주인.
// 어느 탭에 있든 헤더에서 열리므로, 목록 화면이 아니라 여기가 목록을 든다.

const ModalHost = ({ kind, divisionId, divisionName, denyReason, modelKinds, onClose, onChanged }) => {
  const [subjects, setSubjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [reconcile, setReconcile] = useState(null);

  const load = async () => {
    try {
      const [s, a, b, r] = await Promise.all([
        maturityApi.listSubjects(divisionId), maturityApi.listAgents(divisionId),
        maturityApi.getBoard(divisionId), maturityApi.reconcile(divisionId),
      ]);
      setSubjects(s.data); setAgents(a.data);
      setPairs(b.data.subjects.flatMap(x => x.pairs));
      setReconcile(r.data);
    } catch { /* 창 안에서 다시 시도한다 */ }
  };
  useEffect(() => { if (divisionId) load(); }, [divisionId, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = () => { load(); if (onChanged) onChanged(); };
  const pairCount = useMemo(() => {
    const bySubject = {}, byAgent = {};
    pairs.forEach(p => {
      bySubject[p.subject_id] = (bySubject[p.subject_id] || 0) + 1;
      byAgent[p.agent_id] = (byAgent[p.agent_id] || 0) + 1;
    });
    return { bySubject, byAgent };
  }, [pairs]);

  if (kind === 'import') {
    return (
      <ImportModal divisionId={divisionId} divisionName={divisionName} canEdit={!denyReason}
                   denyReason={denyReason} reconcile={reconcile} onClose={onClose} onDone={changed} />
    );
  }
  return (
    <ItemManagerModal
      kind={kind} divisionId={divisionId}
      items={kind === 'subject' ? subjects : agents}
      pairCount={kind === 'subject' ? pairCount.bySubject : pairCount.byAgent}
      canEdit={!denyReason} denyReason={denyReason} modelKinds={modelKinds}
      onClose={onClose} onChanged={changed}
    />
  );
};

export default ModalHost;
