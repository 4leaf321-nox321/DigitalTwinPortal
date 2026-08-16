import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AlertTriangle } from 'lucide-react';
import Header from './components/Layout/Header';
import DiagnosisView from './components/Diagnosis/DiagnosisView';
import IssuesView from './components/Issues/IssuesView';
import AnalysisView from './components/Analysis/AnalysisView';
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

// 이 모듈은 글이 많다. 넓은 모니터에서 폭을 안 잡아두면 짧은 문장 한 줄이
// 2000px 를 차지해 눈이 줄을 놓친다. 표(관측·지표별 연결)에도 1440px 면
// 6열이 넉넉히 들어간다. 고정 바와 내용이 같은 폭을 써야 세로줄이 맞는다.
const Bounded = styled.div`
  max-width: 1440px;
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
  // **돌려준다** — 화면이 그 자리에서 이유를 보여줘야 사용자가 다음 수를 안다.
  const handleApplySurvey = async (cells) => {
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

  const handleCruxAdd = (payload) =>
    runAndReload(() => strategyApi.createCrux(currentYear, payload));

  const handleCruxUpdate = (cruxId, payload) =>
    runAndReload(() => strategyApi.updateCrux(currentYear, cruxId, payload));

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
          categories={meta?.categories || []}
          divisions={meta?.divisions || []}
          metricDefinitions={meta?.metrics || []}
          thresholds={meta?.thresholds || {}}
          assessments={plan.assessments}
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
          onCruxAdd={handleCruxAdd}
          onCruxUpdate={handleCruxUpdate}
          onCruxDelete={handleCruxDelete}
        />
      );
    }

    if (stage === 'issue') {
      return (
        <IssuesView
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

    return (
      <Panel>
        <PanelTitle>{STAGES.find(s => s.key === stage)?.label} 단계는 준비 중입니다</PanelTitle>
        <div>지금은 ① 진단 ~ ③ 분석까지입니다. 계획은 PLAN.md 를 참고하세요.</div>
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
            {STAGES.map(s => (
              <StageTab
                key={s.key}
                $active={stage === s.key}
                onClick={() => setStage(s.key)}
              >
                {s.label}
              </StageTab>
            ))}
          </StageTabs>

          <YearSelector>
            <YearButton onClick={() => setCurrentYear(y => y - 1)} title="이전 년도">‹</YearButton>
            <YearDisplay>{currentYear}년</YearDisplay>
            <YearButton onClick={() => setCurrentYear(y => y + 1)} title="다음 년도">›</YearButton>
          </YearSelector>
        </TopBar>

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
          onClose={() => setShowSettings(false)}
        />
      )}
    </Container>
  );
}

export default DigitalTwinStrategyApp;
