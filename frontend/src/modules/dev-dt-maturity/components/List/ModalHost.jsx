import React, { useEffect, useMemo, useState } from 'react';
import maturityApi from '../../services/maturityApi';
import ItemManagerModal from './ItemManagerModal';
import ImportModal from './ImportModal';

// 헤더 단추가 여는 창 셋(시험 항목 관리 · 시뮬레이션 관리 · 가져오기)의 자료 주인.
// 어느 탭에 있든 헤더에서 열리므로, 목록 화면이 아니라 여기가 목록을 든다.
//
// 「전체」(divisionId === 'all')면 모든 사업부의 항목을 든다 — 목록은 사업부 없이 받고,
// 연계은 전체 판에서 편다. 제품군 찾기의 재료는 사업부마다 다르므로 사업부별로 받아 map 으로 준다.
// 가져오기는 사업부 하나가 있어야 한다(틀이 사업부 것이다) — 전체면 창 안에서 고른다.

const ModalHost = ({ kind, divisionId, divisionName, divisions = [], denyReason, modelKinds, initialId = null,
                     sector = 'simulation', processSteps = [], onClose, onChanged }) => {
  const allMode = divisionId === 'all';
  const [subjects, setSubjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [reconcile, setReconcile] = useState(null);
  const [toolNames, setToolNames] = useState([]);
  const [toolCatalog, setToolCatalog] = useState([]);
  const [familyCatalogs, setFamilyCatalogs] = useState({});
  const [departments, setDepartments] = useState({});   // {division_id: [{id, name}]}
  const [importDivision, setImportDivision] = useState(null);   // 전체일 때 가져올 사업부

  const load = async () => {
    try {
      const [s, a, b, r] = await Promise.all([
        maturityApi.listSubjects(divisionId, sector), maturityApi.listAgents(divisionId, sector),
        maturityApi.getBoard(divisionId, sector),
        // 로드맵 어긋남은 **시뮬레이션의 셈**이다 — 다른 부문에는 로드맵 짝이 없다
        (allMode || sector !== 'simulation') ? Promise.resolve({ data: null }) : maturityApi.reconcile(divisionId),
      ]);
      setSubjects(s.data); setAgents(a.data);
      setPairs(allMode
        ? b.data.boards.flatMap(x => x.subjects.flatMap(sub => sub.pairs))
        : b.data.subjects.flatMap(x => x.pairs));
      setReconcile(r.data);
    } catch { /* 창 안에서 다시 시도한다 */ }
  };
  useEffect(() => { if (divisionId) load(); }, [divisionId, kind, sector]); // eslint-disable-line react-hooks/exhaustive-deps

  // 제안·찾기의 재료 — 도구는 인텔 표(사업부 무관), 제품군은 사업부마다.
  useEffect(() => {
    if (kind === 'subject') {
      const ids = allMode ? divisions.map(d => d.id) : [divisionId];
      Promise.all(ids.map(id => maturityApi.getFamilyCatalog(id).then(r => [id, r.data || []]).catch(() => [id, []])))
        .then(pairsList => setFamilyCatalogs(Object.fromEntries(pairsList)));
    }
    if (kind !== 'agent') return;
    maturityApi.getDepartments(allMode ? 'all' : divisionId)
      .then(r => setDepartments(allMode ? (r.data || {}) : { [divisionId]: r.data || [] }))
      .catch(() => setDepartments({}));
    maturityApi.getToolNames().then(r => setToolNames(r.data || [])).catch(() => setToolNames([]));
    maturityApi.getToolCatalog().then(r => setToolCatalog(r.data || [])).catch(() => setToolCatalog([]));
  }, [kind, divisionId, allMode, divisions, subjects]);

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
    const target = allMode
      ? (divisions.find(d => d.id === importDivision) || divisions.find(d => !d.deny_reason) || divisions[0])
      : null;
    const did = allMode ? target?.id : divisionId;
    const dname = allMode ? target?.name : divisionName;
    const deny = allMode ? (target?.deny_reason || null) : denyReason;
    return (
      <ImportModal divisionId={did} divisionName={dname} canEdit={!deny} denyReason={deny}
                   reconcile={allMode ? null : reconcile} onClose={onClose} onDone={changed}
                   divisions={allMode ? divisions : null} onPickDivision={allMode ? setImportDivision : null} />
    );
  }
  return (
    <ItemManagerModal
      kind={kind} sector={sector} processSteps={processSteps} divisionId={divisionId} allMode={allMode} divisions={divisions}
      items={kind === 'subject' ? subjects : agents}
      pairCount={kind === 'subject' ? pairCount.bySubject : pairCount.byAgent}
      canEdit={!denyReason} denyReason={denyReason} modelKinds={modelKinds}
      toolSuggestions={toolNames} toolCatalog={toolCatalog} familyCatalogs={familyCatalogs} departments={departments}
      initialId={initialId}
      onClose={onClose} onChanged={changed}
    />
  );
};

export default ModalHost;
