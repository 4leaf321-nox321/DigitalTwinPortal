import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Plus, BarChart3, Send, Undo2, Trash2, Pencil, ArrowLeft, X } from 'lucide-react';
import SurveyEditor from './SurveyEditor';
import SurveyResults from './SurveyResults';
import surveyApi from '../../services/surveyApi';
import { ACCENT, ACCENT_DARK, ACCENT_TINT, ACCENT_LINE } from '../../theme';

// 설문 관리 — 만들기 · 배포 · 집계.
//
// 응답은 여기서 하지 않는다. 같은 모듈의 다른 얼굴(components/Respond)이고,
// 헤더에서 전환한다.
//
// **연도라는 개념이 없다.** 예전에는 전략의 연도로 목록을 좁혔는데, 설문은
// 전략 전용이 아니다. 지금은 context_type/context_id 로 좁힌다 — 전략에서
// 넘어오면 그 전략(plan.id)의 설문만, 그냥 들어오면 전부 보인다.
// ⚠️ context_id 는 **연도가 아니라 plan.id** 다. 2026 을 넣으면 26번 계획을
//    가리키게 되어 아무것도 안 잡힌다.

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
  &:hover { color: ${ACCENT}; }
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

const ContextChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid ${ACCENT_LINE};
  border-radius: 0.3rem;
  background: ${ACCENT_TINT};
  color: ${ACCENT_DARK};
  font-size: 0.75rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: ${ACCENT}; }
`;

const AddButton = styled.button`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0.85rem;
  border: none;
  border-radius: 0.375rem;
  background: ${ACCENT};
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: ${ACCENT_DARK}; }
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
  &:hover { border-color: ${ACCENT}; color: ${ACCENT}; }
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

const SurveyManager = ({ context, contextLabel, divisions = [], onClearContext }) => {
  const [surveys, setSurveys] = useState([]);
  const [view, setView] = useState({ mode: 'list' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await surveyApi.listSurveys(context);
      setSurveys(res.data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [context]);

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
        ? surveyApi.updateSurvey(view.survey.id, payload)
        // 새로 만들 때만 context 를 싣는다. 수정할 때 같이 보내면 다른 화면에서
        // 만든 설문이 지금 보고 있는 맥락으로 조용히 옮겨 붙는다.
        : surveyApi.createSurvey({ ...payload, ...(context || {}) })
    ));
    if (ok) setView({ mode: 'list' });
  };

  const openEditor = async (survey) => {
    if (!survey) return setView({ mode: 'edit', survey: null });
    // 목록에는 문항이 없다. 편집하려면 문항까지 받아야 한다.
    try {
      const res = await surveyApi.getSurvey(survey.id);
      // ⚠️ response_count 를 목록 행에서 옮겨 붙인다. 단건 조회는 target_count 만
      //    싣고 response_count 를 안 준다 — 이 줄이 없으면 응답이 있는 설문의
      //    문항 잠금(SurveyEditor 의 locked)이 풀려서, 화면에서는 고칠 수 있는데
      //    저장할 때 409 를 받는 상태가 된다.
      setView({ mode: 'edit', survey: { ...res.data, response_count: survey.response_count } });
    } catch (e) {
      setError(e.message);
    }
  };

  const openResults = async (survey) => {
    setView({ mode: 'results', survey, results: null });
    try {
      const res = await surveyApi.getSurveyResults(survey.id);
      setView({ mode: 'results', survey, results: res.data });
    } catch (e) {
      setError(e.message);
    }
  };

  const reveal = async () => {
    try {
      const res = await surveyApi.getSurveyIdentities(view.survey.id);
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
        <Title>설문 관리</Title>
        {context && (
          // 좁혀 보고 있다는 사실과 푸는 방법을 같이 둔다. 필터가 걸린 줄
          // 모르면 "만든 설문이 목록에 없다"로 읽힌다.
          <ContextChip onClick={onClearContext} title="맥락 필터를 풀고 전체를 봅니다">
            {contextLabel || '특정 맥락'}의 설문만 <X size={12} />
          </ContextChip>
        )}
        <Hint>
          시스템이 모르는 것을 사람에게 묻습니다. 응답은 전 직원이 「내 설문」에서 합니다.
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
                    onClick={() => run(() => surveyApi.setSurveyStatus(s.id, 'closed'))}
                    title="마감 — 더 이상 응답을 받지 않습니다">
                    <Undo2 size={15} />
                  </IconButton>
                ) : (
                  <IconButton
                    onClick={() => run(() => surveyApi.setSurveyStatus(s.id, 'open'))}
                    title="배포 — 대상자에게 보이기 시작합니다">
                    <Send size={15} />
                  </IconButton>
                )}
                <IconButton
                  onClick={() => {
                    // 백엔드가 응답까지 cascade 로 지운다. 아이콘 오클릭 한 번에
                    // 모은 응답이 전부 사라지므로 반드시 되묻는다.
                    const extra = s.response_count > 0
                      ? `

이미 받은 응답 ${s.response_count}건도 함께 사라지며 되돌릴 수 없습니다.`
                      : '';
                    if (!window.confirm(`'${s.title}' 설문을 삭제할까요?${extra}`)) return;
                    run(() => surveyApi.deleteSurvey(s.id));
                  }}
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
