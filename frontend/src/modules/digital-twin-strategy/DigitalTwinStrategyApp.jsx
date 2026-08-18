import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AlertTriangle, Eye } from 'lucide-react';
import Header from './components/Layout/Header';
import DiagnosisView from './components/Diagnosis/DiagnosisView';
import IssuesView from './components/Issues/IssuesView';
import AnalysisView from './components/Analysis/AnalysisView';
import SolutionsView from './components/Solutions/SolutionsView';
import DocumentView from './components/Document/DocumentView';
import ThresholdModal from './components/Settings/ThresholdModal';
import strategyApi from './services/strategyApi';

// 전략은 연도 단위로 세운다. 연도가 이 모듈의 최상위 상태이고, 모든 단계는
// 선택된 연도의 것만 다룬다.
//
// 계획서: ./PLAN.md
// Phase 1 범위는 ① 진단까지다. 나머지 단계는 자리만 잡아둔다.

const STAGES = [
  { key: 'assessment', label: '① 진단' },
  { key: 'issue', label: '② 이슈' },
  { key: 'analysis', label: '③ 분석' },
  { key: 'solution', label: '④ 솔루션' },
  { key: 'document', label: '⑤ 기획서' },
];

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const FixtureBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.5rem;
  background: #fef3c7;
  border-bottom: 1px solid #fde68a;
  color: #92400e;
  font-size: 0.875rem;
  font-weight: 600;
  flex-shrink: 0;
`;

// 단계 탭과 연도는 **스크롤 밖**에 둔다. 지금 어느 단계의 몇 년도를 보고
// 있는지는 화면 아래로 내려가도 계속 보여야 한다. 스크롤 막대도 이 아래에서
// 시작해, 내려가는 것이 '내용'뿐임이 눈에 보인다.
const StickyBar = styled.div`
  flex-shrink: 0;
  padding: 1.25rem 1.5rem 0.875rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const MainContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem 2.5rem;
`;

// ⚠️ **글줄 상한은 여기가 아니라 본문 열에 건다.**
//
// 한동안 이 상자를 1440px 로 묶어 두었다. 이유는 맞았다 — 넓은 모니터에서
// 폭을 안 잡으면 짧은 문장 한 줄이 2000px 를 차지해 눈이 줄을 놓친다.
// 그런데 그 상한이 **곁가지(흐름도·후보 열)까지 같이 묶어서**, 1920 화면에서
// 좌우 480px 를 버리면서 정작 안에서는 서로 폭을 뺏고 있었다.
//
// 이제 상한은 각 화면의 본문 열이 든다(Wrap 의 max-width). 여기서는 곁가지까지
// 들어갈 만큼만 잡는다: 흐름도 208 + 본문 1120 + 후보 열 480 + 여백 = 약 1850.
// 고정 바도 같은 폭이라 **왼쪽 세로줄이 맞는다.**
const Bounded = styled.div`
  max-width: 1860px;
  margin: 0 auto;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const StageTabs = styled.div`
  display: flex;
  gap: 0.375rem;
  background: white;
  padding: 0.375rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
`;

// 탭에 붙는 수. **어디가 비었는지 탭만 보고 알아야 한다** — 지금까지는
// 눌러 봐야 알았다.
const StageCount = styled.span`
  margin-left: 0.35rem;
  padding: 0.05rem 0.3rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: ${p => {
    if (p.$active) return 'rgba(255, 255, 255, 0.22)';
    return p.$empty ? '#fef3c7' : '#f1f5f9';
  }};
  color: ${p => {
    if (p.$active) return 'white';
    return p.$empty ? '#b45309' : '#64748b';
  }};
`;

const StageTab = styled.button`
  padding: 0.5rem 0.875rem;
  border: none;
  border-radius: 0.5rem;
  background: ${p => (p.$active ? '#7c3aed' : 'transparent')};
  color: ${p => (p.$active ? 'white' : '#64748b')};
  font-size: 0.875rem;
  font-weight: 600;
  cursor: ${p => (p.$disabled ? 'not-allowed' : 'pointer')};
  opacity: ${p => (p.$disabled ? 0.4 : 1)};
  transition: all 0.15s ease;

  &:hover {
    background: ${p => (p.$active ? '#7c3aed' : '#f1f5f9')};
  }
`;

const YearSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
`;

const YearButton = styled.button`
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
    color: #334155;
  }
`;

const YearDisplay = styled.div`
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  min-width: 80px;
  text-align: center;
`;

// ⚠️ **확정은 ⑤ 에서만 하지만 어느 단계에서나 보여야 한다.** 확정본을 보고
//    있는 줄 모르고 진단을 고치면, 고친 것이 문서에 안 들어간 이유를 못 찾는다.
// 조회 전용임을 늘 보이게 둔다. 단추가 안 보이는 이유를 모르면 사람은
// 화면이 고장 난 줄 안다.
const ReadOnlyBar = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  margin-top: 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const ConfirmedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.45rem;
  border-radius: 0.3rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
  font-size: 0.6875rem;
  font-weight: 700;
`;

const Panel = styled.div`
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.75rem;
  padding: 3rem 1.5rem;
  text-align: center;
  color: #94a3b8;
`;

const PanelTitle = styled.div`
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.5rem;
`;

const CreateButton = styled.button`
  margin-top: 1rem;
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }
`;

// 고정 바 안에 둔다. 화면 아래에서 저장하다 실패했는데 오류가 맨 위에만
// 뜨면 아무도 못 본다 — 저장이 안 된 줄 모르고 넘어간다.
// ⚠️ **된 일을 빨간 상자에 띄우지 않는다.** 「목표 19칸을 정했습니다」가
//    오류처럼 보이면 사람은 뭔가 잘못된 줄 알고 손을 멈춘다.
const NoticeBox = styled.div`
  padding: 0.75rem 1rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.5rem;
  color: #15803d;
  font-size: 0.875rem;
  margin-top: 0.875rem;
`;

const ErrorBox = styled.div`
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #b91c1c;
  font-size: 0.875rem;
  margin-top: 0.875rem;
`;

function DigitalTwinStrategyApp({ onGoHome }) {
  const navigate = useNavigate();
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [stage, setStage] = useState('assessment');
  const [meta, setMeta] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  // 된 일. 오류와 자리는 같지만 **색이 달라야 한다.**
  const [notice, setNotice] = useState(null);
  // ⑤ 기획서. plan 과 따로 읽는다 — 문서를 안 보는 동안 조립할 이유가 없다.
  const [document_, setDocument] = useState(null);

  useEffect(() => {
    strategyApi.getMeta()
      .then(res => setMeta(res.data))
      .catch(e => setError(e.message));
  }, []);

  // 다시 읽기만 한다. loading 을 건드리지 않는 것이 요점이다.
  const fetchPlan = useCallback(async (year) => {
    const res = await strategyApi.getPlan(year);
    setPlan(res.data);
  }, []);

  // 화면 전체를 "불러오는 중"으로 덮는다. **처음 열 때와 연도를 바꿀 때만**
  // 쓴다. 저장할 때마다 이걸 쓰면 내용이 통째로 사라졌다 돌아오면서
  // 스크롤이 맨 위로 튄다 — 항목 하나 추가했을 뿐인데 보던 자리를 잃는다.
  const loadPlan = useCallback(async (year) => {
    setLoading(true);
    setError(null);
    try {
      await fetchPlan(year);
    } catch (e) {
      setError(e.message);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [fetchPlan]);

  useEffect(() => { loadPlan(currentYear); }, [currentYear, loadPlan]);

  // 단계에 들어올 때, 그리고 앞 단계를 고친 뒤 돌아올 때 다시 읽는다.
  // ⚠️ **plan 이 바뀌면 같이 읽어야 한다.** 문서는 앞 단계를 조립한 것이라,
  //    진단을 고치고 ⑤ 로 오면 옛 조립본이 보이면 안 된다.
  useEffect(() => {
    if (stage !== 'document' || !plan) { return; }
    strategyApi.getDocument(currentYear)
      .then(res => setDocument(res.data))
      .catch(e => setError(e.message));
  }, [stage, plan, currentYear]);

  const runDocument = async (fn) => {
    if (!canEdit) { setError(denied); return false; }
    setError(null);
    try {
      const res = await fn();
      setDocument(res.data);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const handleDocumentSave = (sections) =>
    runDocument(() => strategyApi.updateDocument(currentYear, sections));

  const handleDocumentStatus = (status) =>
    runDocument(() => strategyApi.setDocumentStatus(currentYear, status));

  const handleDocumentExport = async () => {
    setError(null);
    try {
      await strategyApi.downloadDocument(currentYear);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await strategyApi.createPlan(currentYear);
      await loadPlan(currentYear);
    } catch (e) {
      setError(e.message);
    }
  };

  // 낙관적 갱신 없이 저장 후 다시 읽는다. 격차(gap)·후보 목록·집계가 전부
  // 서버 계산이라 화면에서 흉내 내면 규칙이 두 곳으로 갈린다.
  const handleAssessmentChange = (divisionId, category, dimension, payload) =>
    runAndReload(() =>
      strategyApi.updateAssessment(currentYear, divisionId, category, dimension, payload));

  const handleMetricTargetChange = (divisionId, metricKey, payload) =>
    runAndReload(() =>
      strategyApi.updateMetricTarget(currentYear, divisionId, metricKey, payload));

  // 저장하고 전체를 다시 읽는다. 격차·후보 목록·난제별 집계가 전부 서버 계산이라
  // 화면에서 흉내 내면 규칙이 두 곳으로 갈린다.
  //
  // 던지지 않고 성공 여부를 돌려준다. 던지면 호출부가 안 잡았을 때 unhandled
  // rejection 이 되고, 화면은 저장된 것처럼 보인다.
  const runAndReload = async (fn) => {
    // ⚠️ **한 곳에서 막는다.** 화면마다 단추를 감추지만 하나쯤 빠뜨리기 마련이라,
    //    보내기 전에 여기서 한 번 더 본다. 서버도 막지만 그건 403 이고,
    //    사람에게는 여기서 나온 말이 더 친절하다.
    if (!canEdit) { setError(denied); return false; }
    setError(null);
    try {
      // ⚠️ 서버가 돌려준 것을 **그대로 넘긴다.** 만들자마자 그 항목으로
      //    데려가려면 화면이 새로 생긴 id 를 알아야 한다. 예전에는 true 만
      //    돌려줘서, 저장한 사람이 그것을 눈으로 찾아야 했다.
      //    실패는 여전히 false 이므로 `ok !== false` 로 보던 곳은 그대로 돈다.
      const result = await fn();
      // loadPlan 이 아니라 fetchPlan 이다. 화면을 덮지 않아야 보던 자리가 남는다.
      await fetchPlan(currentYear);
      return result ?? true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  // 반영하고 전체를 다시 읽는다. 반영 결과(몇 칸이 되고 몇 칸이 건너뛰어졌나)는
  // **돌려준다** — 화면이 그 자리에서 이유를 보여줘야 사용자가 다음에 무엇을 할지 안다.
  const handleApplySurvey = async (cells) => {
    if (!canEdit) { setError(denied); return false; }
    setError(null);
    try {
      const res = await strategyApi.applySurveyEvidence(currentYear, cells);
      await fetchPlan(currentYear);
      return res?.data || null;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  // 결과를 저장하지 않고 돌려주기만 한다. 저장하면 원문이 늘어난 뒤에도 낡은
  // 요약이 남고, 그것이 어느 시점의 것인지 아무도 모른다.
  const handleLoadVoices = async () => {
    // ⚠️ 서술형 **원문 인용**을 읽는다. 설문 응답자에게 「관리자는 확인 가능」
    //    이라고 고지했지 「전 직원이 확인 가능」이라고 하지 않았다.
    if (!canEdit) { setError(denied); return null; }
    setError(null);
    try {
      const res = await strategyApi.loadSurveyVoices(currentYear);
      return res?.data || null;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  const handleElementCreate = (payload) =>
    runAndReload(() => strategyApi.createElement(currentYear, payload));
  const handleElementUpdate = (id, payload) =>
    runAndReload(() => strategyApi.updateElement(currentYear, id, payload));
  const handleElementDelete = (id) =>
    runAndReload(() => strategyApi.deleteElement(currentYear, id));

  const handleSolutionCreate = (payload) =>
    runAndReload(() => strategyApi.createSolution(currentYear, payload));
  const handleSolutionUpdate = (id, payload) =>
    runAndReload(() => strategyApi.updateSolution(currentYear, id, payload));
  const handleSolutionDelete = (id) =>
    runAndReload(() => strategyApi.deleteSolution(currentYear, id));

  // 게이트 다섯 칸을 **한 번에** 저장한다. 칸마다 저장하면 다섯 번 저장하고 다섯
  // 번 새로 읽는 동안 화면이 다섯 번 흔들린다. 비운 칸은 지우기다 — 안 답한
  // 상태로 되돌린다.
  // 과제 검색. **plan 을 다시 읽지 않는다** — 검색은 읽기라 화면을 흔들 이유가
  // 없다. 실패하면 빈 목록을 돌려주고 오류를 위에 띄운다.
  const handleSearchProjects = async ({ q, divisionId }) => {
    try {
      const res = await strategyApi.searchProjects(currentYear, { q, divisionId });
      return res?.data || { items: [], total: 0, truncated: false };
    } catch (e) {
      setError(e.message);
      return { items: [], total: 0, truncated: false };
    }
  };

  const handleGatesSave = async (solutionId, entries) => {
    setError(null);
    try {
      for (const e of entries) {
        if (e.answer) {
          await strategyApi.saveGate(currentYear, solutionId, e.gate,
            { answer: e.answer, status: e.status });
        } else {
          await strategyApi.clearGate(currentYear, solutionId, e.gate);
        }
      }
      await fetchPlan(currentYear);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  // 이슈 여러 개를 묶어 난제로. 난제 생성과 이슈 재배치가 **한 번에** 일어나야
  // 하므로 서버가 한 트랜잭션으로 한다(cruxes/from-issues).
  const handleRollup = (payload) =>
    runAndReload(() => strategyApi.createCruxFromIssues(currentYear, payload));

  const handleThresholdSave = async (thresholds) => {
    await strategyApi.updateThresholds(thresholds);
    // meta 도 다시 읽는다 — 관측 표의 색이 이 임계값을 쓰므로 같이 바뀌어야 한다.
    const refreshed = await strategyApi.getMeta();
    setMeta(refreshed.data);
    await fetchPlan(currentYear);
  };

  // 목표 일괄. 몇 칸이 바뀌었고 몇 칸이 왜 안 바뀌었는지 그 자리에서 말한다 —
  // 「50칸인데 19칸만 바뀌었다」가 왜인지 모르면 고장으로 읽힌다.
  const handleBumpTargets = async () => {
    if (!canEdit) { setError(denied); return; }
    setError(null);
    setNotice(null);
    try {
      const res = await strategyApi.bumpTargets(currentYear);
      const d = res?.data || {};
      await fetchPlan(currentYear);
      const rest = [
        d.keptExisting ? `이미 목표가 있는 ${d.keptExisting}칸은 그대로` : null,
        d.skippedNoLevel ? `현재 수준이 없는 ${d.skippedNoLevel}칸은 건너뜀` : null,
      ].filter(Boolean).join(' · ');
      setNotice(`목표 ${d.changed || 0}칸을 한 단계 위로 정했습니다.`
                + (rest ? ` (${rest})` : ''));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCruxAdd = (payload) =>
    runAndReload(() => strategyApi.createCrux(currentYear, payload));

  const handleCruxUpdate = (cruxId, payload) =>
    runAndReload(() => strategyApi.updateCrux(currentYear, cruxId, payload));

  // 난제를 이슈로 내린다. 딸린 이슈도 같이 옮기므로 서버가 한 트랜잭션으로 한다.
  const handleCruxDemote = (cruxId, targetCruxId) =>
    runAndReload(() => strategyApi.demoteCrux(currentYear, cruxId, targetCruxId));

  const handleCruxDelete = (cruxId) =>
    runAndReload(() => strategyApi.deleteCrux(currentYear, cruxId));

  const handleIssueCreate = (payload) =>
    runAndReload(() => strategyApi.createIssue(currentYear, payload));

  const handleIssueUpdate = (issueId, payload) =>
    runAndReload(() => strategyApi.updateIssue(currentYear, issueId, payload));

  const handleIssueDelete = (issueId) =>
    runAndReload(() => strategyApi.deleteIssue(currentYear, issueId));

  // 설문은 독립 모듈이라 화면을 넘어간다. 지금 보고 있는 전략을 context 로
  // 달아 보내면 저쪽에서 그 전략의 설문만 걸러 보여준다. 전략이 아직 없으면
  // 매달 곳이 없으므로 그냥 설문 목록으로 간다.
  const goToSurveys = () => {
    const query = plan
      ? `?context_type=strategy_plan&context_id=${plan.id}&label=${encodeURIComponent(`${currentYear}년 전략`)}`
      : '';
    navigate(`/survey${query}`);
  };

  const isFixture = meta?.evidenceMode === 'fixture';

  // 단계마다 「얼마나 찼나」. 비면 노란색으로 뜬다.
  const stageCount = (key) => {
    if (!plan) return null;
    if (key === 'assessment') {
      const filled = (plan.assessments || [])
        .filter(a => a.current_level !== null).length;
      return { text: `${filled}/${(plan.assessments || []).length}`,
               empty: filled === 0 };
    }
    if (key === 'issue') {
      const live = (plan.issues || []).filter(i => i.status !== 'dropped').length;
      return { text: String(live), empty: live === 0 };
    }
    if (key === 'analysis') {
      const n = (plan.elements || []).length;
      return { text: String(n), empty: n === 0 };
    }
    if (key === 'solution') {
      const n = (plan.solutions || []).length;
      return { text: String(n), empty: n === 0 };
    }
    if (key === 'document') {
      // 기획서는 건수가 아니라 상태다. 「몇 장」은 늘 열 장이라 뜻이 없다.
      return plan.status === 'confirmed'
        ? { text: '확정', empty: false } : { text: '초안', empty: false };
    }
    return null;
  };
  // ⚠️ **서버가 정본이다.** 이 값은 단추를 감추는 편의일 뿐이고, 실제로 막는
  //    것은 라우트의 edit_required 다. meta 를 못 읽었으면 못 고치는 쪽으로 둔다.
  const canEdit = meta?.canEdit === true;
  const denied = '편집은 매니저 이상만 할 수 있습니다. 조회는 그대로 하실 수 있습니다.';

  const renderStage = () => {
    if (loading) return <Panel>불러오는 중…</Panel>;

    if (!plan) {
      return (
        <Panel>
          <PanelTitle>{currentYear}년 전략이 아직 없습니다</PanelTitle>
          <div>먼저 전략을 만들고 현재 상태 진단부터 시작합니다.</div>
          <CreateButton onClick={handleCreate}>{currentYear}년 전략 만들기</CreateButton>
        </Panel>
      );
    }

    if (stage === 'assessment') {
      return (
        <DiagnosisView
          canEdit={canEdit}
          onMetricDetail={(metricKey, scope) =>
            strategyApi.metricDetail(year, metricKey, scope)}
          categories={meta?.categories || []}
          divisions={meta?.divisions || []}
          metricDefinitions={meta?.metrics || []}
          thresholds={meta?.thresholds || {}}
          assessments={plan.assessments}
          issues={plan.issues || []}
          metrics={plan.metrics}
          metricsError={plan.metricsError}
          kpiCoverage={plan.kpiCoverage}
          processMetrics={plan.processMetrics}
          findings={plan.findings}
          cruxes={plan.cruxes}
          surveyEvidence={plan.surveyEvidence}
          surveyVoicesAvailable={plan.surveyVoicesAvailable}
          onApplySurvey={handleApplySurvey}
          onLoadVoices={handleLoadVoices}
          onChange={handleAssessmentChange}
          onTargetChange={handleMetricTargetChange}
          onBumpTargets={handleBumpTargets}
          onCruxAdd={handleCruxAdd}
          onCruxUpdate={handleCruxUpdate}
          onCruxDelete={handleCruxDelete}
          onCruxDemote={handleCruxDemote}
        />
      );
    }

    if (stage === 'issue') {
      return (
        <IssuesView
          canEdit={canEdit}
          cruxes={plan.cruxes || []}
          issues={plan.issues || []}
          candidates={plan.issueCandidates || []}
          coverage={plan.issueCoverage}
          divisions={meta?.divisions || []}
          onCreate={handleIssueCreate}
          onUpdate={handleIssueUpdate}
          onDelete={handleIssueDelete}
          onRollup={handleRollup}
        />
      );
    }

    if (stage === 'analysis') {
      return (
        <AnalysisView
          canEdit={canEdit}
          elements={plan.elements || []}
          candidates={plan.elementCandidates || []}
          summary={plan.elementSummary}
          divisions={meta?.divisions || []}
          onCreate={handleElementCreate}
          onUpdate={handleElementUpdate}
          onDelete={handleElementDelete}
        />
      );
    }

    if (stage === 'solution') {
      return (
        <SolutionsView
          canEdit={canEdit}
          solutions={plan.solutions || []}
          elements={plan.elements || []}
          divisions={meta?.divisions || []}
          gateDefinitions={meta?.gates || []}
          kpiDefinitions={meta?.kpis || []}
          linkedProjects={plan.linkedProjects || {}}
          nowMax={meta?.thresholds?.solution_now_max ?? 5}
          onSearchProjects={handleSearchProjects}
          onGoAnalysis={() => setStage('analysis')}
          onCreate={handleSolutionCreate}
          onUpdate={handleSolutionUpdate}
          onDelete={handleSolutionDelete}
          onGatesSave={handleGatesSave}
        />
      );
    }

    if (stage === 'document') {
      return (
        <DocumentView
          canEdit={canEdit}
          year={currentYear}
          doc={document_}
          onSave={handleDocumentSave}
          onSetStatus={handleDocumentStatus}
          onExport={handleDocumentExport}
        />
      );
    }

    return (
      <Panel>
        <PanelTitle>{STAGES.find(s => s.key === stage)?.label} 단계는 준비 중입니다</PanelTitle>
        <div>계획은 PLAN.md 를 참고하세요.</div>
      </Panel>
    );
  };

  return (
    <Container>
      <Header
        onGoHome={onGoHome}
        onOpenSettings={() => setShowSettings(true)}
        onOpenSurveys={goToSurveys}
      />

      {isFixture && (
        <FixtureBanner>
          <AlertTriangle size={16} />
          개발용 합성 데이터로 동작 중입니다. 여기서 만든 전략은 실제 산출물이 아닙니다.
        </FixtureBanner>
      )}

      <StickyBar>
       <Bounded>
        <TopBar>
          <StageTabs>
            {STAGES.map(s => {
              const count = stageCount(s.key);
              return (
                <StageTab
                  key={s.key}
                  $active={stage === s.key}
                  onClick={() => setStage(s.key)}
                >
                  {s.label}
                  {count && (
                    <StageCount $active={stage === s.key} $empty={count.empty}>
                      {count.text}
                    </StageCount>
                  )}
                </StageTab>
              );
            })}
          </StageTabs>

          <YearSelector>
            <YearButton onClick={() => setCurrentYear(y => y - 1)} title="이전 년도">‹</YearButton>
            <YearDisplay>{currentYear}년</YearDisplay>
            {plan?.status === 'confirmed' && (
              <ConfirmedBadge title="⑤ 기획서를 확정했습니다. 앞 단계를 고쳐도 그 문서는 안 바뀝니다.">
                확정
              </ConfirmedBadge>
            )}
            <YearButton onClick={() => setCurrentYear(y => y + 1)} title="다음 년도">›</YearButton>
          </YearSelector>
        </TopBar>

        {!canEdit && (
          <ReadOnlyBar>
            <Eye size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>
              <strong>조회 전용입니다.</strong> 편집은 매니저 이상이 합니다 —
              진단·이슈·솔루션·기획서를 보고 사업부로 걸러 볼 수 있고,
              기획서를 Word 로 받을 수도 있습니다.
            </span>
          </ReadOnlyBar>
        )}
        {notice && <NoticeBox>{notice}</NoticeBox>}
        {error && <ErrorBox>{error}</ErrorBox>}
       </Bounded>
      </StickyBar>

      <MainContent>
       <Bounded>
        {renderStage()}
       </Bounded>
      </MainContent>

      {showSettings && (
        <ThresholdModal
          definitions={meta?.thresholdDefinitions || []}
          values={meta?.thresholds || {}}
          onSave={handleThresholdSave}
          onPreview={(key) => strategyApi
            .previewThresholds(currentYear, key)
            .then(res => res?.data || null)
            .catch(() => null)}
          onClose={() => setShowSettings(false)}
        />
      )}
    </Container>
  );
}

export default DigitalTwinStrategyApp;
