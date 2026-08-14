import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { AlertTriangle } from 'lucide-react';
import Header from './components/Layout/Header';
import AssessmentView from './components/Assessment/AssessmentView';
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

const MainContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
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

const ErrorBox = styled.div`
  padding: 1rem 1.25rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #b91c1c;
  font-size: 0.875rem;
  margin-bottom: 1rem;
`;

function DigitalTwinStrategyApp({ onGoHome }) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [stage, setStage] = useState('assessment');
  const [meta, setMeta] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    strategyApi.getMeta()
      .then(res => setMeta(res.data))
      .catch(e => setError(e.message));
  }, []);

  const loadPlan = useCallback(async (year) => {
    setLoading(true);
    setError(null);
    try {
      const res = await strategyApi.getPlan(year);
      setPlan(res.data);
    } catch (e) {
      setError(e.message);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleAssessmentChange = async (dimension, payload) => {
    // 낙관적 갱신 없이 저장 후 다시 읽는다. 격차(gap)는 서버가 계산하므로
    // 화면에서 흉내 내면 규칙이 두 곳으로 갈린다.
    setError(null);
    try {
      await strategyApi.updateAssessment(currentYear, dimension, payload);
      await loadPlan(currentYear);
    } catch (e) {
      setError(e.message);
    }
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
        <AssessmentView
          dimensions={meta?.dimensions || []}
          assessments={plan.assessments}
          onChange={handleAssessmentChange}
        />
      );
    }

    return (
      <Panel>
        <PanelTitle>{STAGES.find(s => s.key === stage)?.label} 단계는 준비 중입니다</PanelTitle>
        <div>Phase 1 은 진단까지입니다. 계획은 PLAN.md 를 참고하세요.</div>
      </Panel>
    );
  };

  return (
    <Container>
      <Header onGoHome={onGoHome} />

      {isFixture && (
        <FixtureBanner>
          <AlertTriangle size={16} />
          개발용 합성 데이터로 동작 중입니다. 여기서 만든 전략은 실제 산출물이 아닙니다.
        </FixtureBanner>
      )}

      <MainContent>
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

        {renderStage()}
      </MainContent>
    </Container>
  );
}

export default DigitalTwinStrategyApp;
