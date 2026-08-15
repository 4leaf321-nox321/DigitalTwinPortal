import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Plus, BarChart3, Send, Undo2, Trash2, Pencil, ArrowLeft } from 'lucide-react';
import SurveyEditor from './SurveyEditor';
import SurveyResults from './SurveyResults';
import strategyApi from '../../services/strategyApi';

// 설문 관리 — 만들기 · 배포 · 집계.
//
// 설문은 단계가 아니라 **모든 단계를 가로지르는 두 번째 근거 원천**이라,
// ①~⑤ 탭에 넣지 않고 헤더에서 여는 별도 화면으로 둔다. 탭에 끼우면 5단계
// 척추가 6개로 읽힌다.
//
// 응답은 여기서 하지 않는다. 전사 대상이라 별도 모듈(/survey)이다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const Back = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { color: #7c3aed; }
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const Hint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const AddButton = styled.button`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0.85rem;
  border: none;
  border-radius: 0.375rem;
  background: #7c3aed;
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: #6d28d9; }
`;

const Card = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 0.875rem 1.125rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const CardTitle = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
`;

const Meta = styled.div`
  display: flex;
  gap: 0.375rem;
  margin-top: 0.35rem;
  flex-wrap: wrap;
`;

const Tag = styled.span`
  padding: 0.1rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: ${p => p.$bg || '#f1f5f9'};
  color: ${p => p.$fg || '#64748b'};
`;

const Buttons = styled.div`
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
`;

const IconButton = styled.button`
  padding: 0.35rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  color: #64748b;
  cursor: pointer;
  display: flex;
  &:hover { border-color: #a78bfa; color: #7c3aed; }
`;

const Panel = styled.div`
  padding: 1.125rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const Empty = styled.div`
  padding: 2rem 1.25rem;
  text-align: center;
  color: #94a3b8;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.7;
`;

const ErrorBox = styled.div`
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #b91c1c;
  font-size: 0.8125rem;
`;

const STATUS = {
  draft: { label: '작성 중', bg: '#f1f5f9', fg: '#64748b' },
  open: { label: '응답 받는 중', bg: '#dcfce7', fg: '#15803d' },
  closed: { label: '마감', bg: '#f1f5f9', fg: '#94a3b8' },
};

const SurveyManager = ({ year, categories, divisions, onClose }) => {
  const [surveys, setSurveys] = useState([]);
  const [view, setView] = useState({ mode: 'list' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await strategyApi.listSurveys(year);
      setSurveys(res.data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setError(null);
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const save = async (payload) => {
    const ok = await run(() => (
      view.survey
        ? strategyApi.updateSurvey(view.survey.id, payload)
        : strategyApi.createSurvey(year, payload)
    ));
    if (ok) setView({ mode: 'list' });
  };

  const openEditor = async (survey) => {
    if (!survey) return setView({ mode: 'edit', survey: null });
    // 목록에는 문항이 없다. 편집하려면 문항까지 받아야 한다.
    try {
      const res = await strategyApi.getSurvey(survey.id);
      setView({ mode: 'edit', survey: { ...res.data, response_count: survey.response_count } });
    } catch (e) {
      setError(e.message);
    }
  };

  const openResults = async (survey) => {
    setView({ mode: 'results', survey, results: null });
    try {
      const res = await strategyApi.getSurveyResults(survey.id);
      setView({ mode: 'results', survey, results: res.data });
    } catch (e) {
      setError(e.message);
    }
  };

  const reveal = async () => {
    try {
      const res = await strategyApi.getSurveyIdentities(view.survey.id);
      return res.data;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  if (view.mode === 'results') {
    return (
      <Wrap>
        {error && <ErrorBox>{error}</ErrorBox>}
        <SurveyResults
          results={view.results}
          divisions={divisions}
          onBack={() => setView({ mode: 'list' })}
          onReveal={reveal}
        />
      </Wrap>
    );
  }

  if (view.mode === 'edit') {
    return (
      <Wrap>
        <Back onClick={() => setView({ mode: 'list' })}>
          <ArrowLeft size={15} /> 설문 목록
        </Back>
        <Title>{view.survey ? '설문 수정' : '새 설문'}</Title>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Panel>
          <SurveyEditor
            survey={view.survey}
            categories={categories}
            onSave={save}
            onCancel={() => setView({ mode: 'list' })}
          />
        </Panel>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Head>
        <Back onClick={onClose}><ArrowLeft size={15} /> 전략으로</Back>
        <Title>설문</Title>
        <Hint>
          시스템이 모르는 것을 사람에게 묻습니다. 응답은 전 직원이 별도 화면에서 합니다.
        </Hint>
        <AddButton onClick={() => openEditor(null)}>
          <Plus size={15} /> 새 설문
        </AddButton>
      </Head>

      {error && <ErrorBox>{error}</ErrorBox>}

      {loading ? (
        <Empty>불러오는 중…</Empty>
      ) : surveys.length === 0 ? (
        <Empty>
          아직 설문이 없습니다.<br />
          진단의 <strong>조직 역량 5축</strong>은 시스템이 알 방법이 없어 설문이
          정석입니다 — 새 설문에서 <strong>「조직 역량 5축으로 채우기」</strong>를
          누르면 문항이 한 번에 만들어집니다.
        </Empty>
      ) : (
        surveys.map(s => {
          const st = STATUS[s.status] || STATUS.draft;
          return (
            <Card key={s.id}>
              <Body>
                <CardTitle>{s.title}</CardTitle>
                <Meta>
                  <Tag $bg={st.bg} $fg={st.fg}>{st.label}</Tag>
                  <Tag>문항 {s.question_count}개</Tag>
                  <Tag>응답 {s.response_count} / 대상 {s.target_count}</Tag>
                </Meta>
              </Body>
              <Buttons>
                <IconButton onClick={() => openResults(s)} title="집계 보기">
                  <BarChart3 size={15} />
                </IconButton>
                <IconButton onClick={() => openEditor(s)} title="수정">
                  <Pencil size={15} />
                </IconButton>
                {s.status === 'open' ? (
                  <IconButton
                    onClick={() => run(() => strategyApi.setSurveyStatus(s.id, 'closed'))}
                    title="마감 — 더 이상 응답을 받지 않습니다">
                    <Undo2 size={15} />
                  </IconButton>
                ) : (
                  <IconButton
                    onClick={() => run(() => strategyApi.setSurveyStatus(s.id, 'open'))}
                    title="배포 — 대상자에게 보이기 시작합니다">
                    <Send size={15} />
                  </IconButton>
                )}
                <IconButton
                  onClick={() => run(() => strategyApi.deleteSurvey(s.id))}
                  title="삭제">
                  <Trash2 size={15} />
                </IconButton>
              </Buttons>
            </Card>
          );
        })
      )}
    </Wrap>
  );
};

export default SurveyManager;
